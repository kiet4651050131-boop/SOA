// Client gọi dịch vụ theo TÊN (không hard-code URL):
//  - dò tìm instance qua Service Registry (cache ngắn, dùng cache cũ nếu registry sập)
//  - cân bằng tải round-robin giữa các instance
//  - timeout + retry với exponential backoff
//  - circuit breaker theo từng instance
const { registryUrl, internalKey } = require('./env');

const CACHE_MS = Number(process.env.DISCOVERY_CACHE_MS || 2000);
const BREAKER_FAILS = 3;
const BREAKER_OPEN_MS = Number(process.env.BREAKER_OPEN_MS || 10000);

const cache = new Map();     // name -> { at, instances }
const cursor = new Map();    // name -> số thứ tự round-robin
const breakers = new Map();  // url  -> { fails, openUntil, trial }

class ServiceUnavailableError extends Error {
    constructor(service, cause) {
        super(`Dịch vụ "${service}" tạm thời không khả dụng`);
        this.status = 503;
        this.service = service;
        this.cause = cause;
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function internalFetch(url, opts = {}) {
    return fetch(url, {
        ...opts,
        headers: { 'x-internal-key': internalKey(), ...(opts.headers || {}) },
        signal: opts.signal || AbortSignal.timeout(opts.timeout || 2000)
    });
}

async function lookup(name) {
    const c = cache.get(name);
    if (c && Date.now() - c.at < CACHE_MS) return c.instances;
    try {
        const r = await internalFetch(`${registryUrl()}/services/${encodeURIComponent(name)}`, { timeout: 1500 });
        if (r.ok) {
            const { instances } = await r.json();
            cache.set(name, { at: Date.now(), instances });
            return instances;
        }
    } catch { /* registry sập: dùng cache cũ */ }
    return c ? c.instances : [];
}

function breakerState(url) {
    if (!breakers.has(url)) breakers.set(url, { fails: 0, openUntil: 0, trial: false });
    return breakers.get(url);
}

function available(url) {
    const b = breakerState(url);
    if (b.fails < BREAKER_FAILS) return true;
    if (Date.now() >= b.openUntil && !b.trial) { b.trial = true; return true; } // half-open: cho thử 1 lần
    return false;
}

const recordSuccess = (url) => { const b = breakerState(url); b.fails = 0; b.trial = false; };
function recordFailure(url) {
    const b = breakerState(url);
    b.fails++;
    b.trial = false;
    if (b.fails >= BREAKER_FAILS) b.openUntil = Date.now() + BREAKER_OPEN_MS;
}

function pick(name, instances) {
    const usable = instances.filter((i) => available(i.url));
    if (!usable.length) return null;
    const n = (cursor.get(name) || 0) % usable.length;
    cursor.set(name, n + 1);
    return usable[n];
}

/**
 * Gọi một dịch vụ theo tên.
 * Trả về { status, headers, buffer, json() }. Ném ServiceUnavailableError (503) nếu không gọi được.
 */
async function call(name, { method = 'GET', path = '/', headers = {}, body, timeout = 3000, retries = 2 } = {}) {
    const hasBody = body !== undefined && body !== null;
    const payload = !hasBody ? undefined
        : (Buffer.isBuffer(body) || typeof body === 'string') ? body : JSON.stringify(body);
    const idempotent = ['GET', 'HEAD', 'PUT', 'DELETE'].includes(method.toUpperCase());

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const instances = await lookup(name);
        const inst = pick(name, instances);

        if (!inst) {
            lastErr = new Error('không có instance khỏe mạnh');
            cache.delete(name);
            if (attempt < retries) { await sleep(200 * 2 ** attempt); continue; }
            break;
        }

        try {
            const h = { ...headers };
            if (hasBody && !Object.keys(h).some((k) => k.toLowerCase() === 'content-type')) {
                h['content-type'] = 'application/json';
            }
            h['x-internal-key'] = internalKey();

            const res = await fetch(inst.url + path, {
                method, headers: h, body: payload, signal: AbortSignal.timeout(timeout)
            });
            const buffer = Buffer.from(await res.arrayBuffer());

            if (res.status === 502 || res.status === 503 || res.status === 504) {
                recordFailure(inst.url);
                cache.delete(name);
                lastErr = new Error('HTTP ' + res.status);
                if (idempotent && attempt < retries) { await sleep(200 * 2 ** attempt); continue; }
                break;
            }

            recordSuccess(inst.url);
            return {
                status: res.status,
                headers: Object.fromEntries(res.headers),
                buffer,
                json() { return JSON.parse(buffer.toString('utf8') || 'null'); }
            };
        } catch (e) {
            recordFailure(inst.url);
            cache.delete(name);
            lastErr = e;
            const refused = e && e.cause && e.cause.code === 'ECONNREFUSED'; // chưa gửi được gì -> an toàn để thử lại
            if ((idempotent || refused) && attempt < retries) { await sleep(200 * 2 ** attempt); continue; }
            break;
        }
    }
    throw new ServiceUnavailableError(name, lastErr);
}

module.exports = { call, lookup, internalFetch, ServiceUnavailableError };
