// EVENT BUS – giao tiếp bất đồng bộ giữa các dịch vụ (publish/subscribe).
// Bảo đảm "at-least-once": lưu hàng đợi xuống đĩa, giao lại theo exponential backoff, quá số lần thì vào dead-letter.
require('../shared/env');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT } = require('../shared/env');
const { readJson, send, guardInternal } = require('../shared/httpx');
const { call } = require('../shared/client');
const log = require('../shared/log')('event-bus');

const PORT = Number(process.env.EVENT_BUS_PORT || 3600);
const DATA_FILE = process.env.EVENT_BUS_DATA || path.join(ROOT, 'data', 'event-bus.json');
const MAX_ATTEMPTS = Number(process.env.BUS_MAX_ATTEMPTS || 10);
const RETRY_BASE_MS = Number(process.env.BUS_RETRY_BASE_MS || 1000);
const MAX_INFLIGHT = 10;

let state = { subs: {}, queue: [], dlq: [] };   // subs: { service: { topics, path } }
const seen = new Set();                           // chống publish trùng id
let inflight = 0;
let delivered = 0;

try {
    if (fs.existsSync(DATA_FILE)) {
        state = { subs: {}, queue: [], dlq: [], ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
        log(`Khôi phục: ${Object.keys(state.subs).length} subscriber, ${state.queue.length} tin chờ giao`);
    }
} catch (e) {
    log('Không đọc được dữ liệu cũ:', e.message);
}

let saveTimer = null;
function save() {
    try {
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
        const tmp = DATA_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(state, (k, v) => (k === 'inflight' ? undefined : v)));
        fs.renameSync(tmp, DATA_FILE);
    } catch (e) {
        log('Lỗi lưu hàng đợi:', e.message);
    }
}
function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
}

const matches = (pattern, topic) =>
    pattern === '*' || pattern === topic || (pattern.endsWith('.*') && topic.startsWith(pattern.slice(0, -1)));

function publish(ev) {
    if (seen.has(ev.id)) return { id: ev.id, duplicate: true };
    seen.add(ev.id);
    if (seen.size > 5000) seen.delete(seen.values().next().value);
    let n = 0;
    for (const [service, s] of Object.entries(state.subs)) {
        if (s.topics.some((t) => matches(t, ev.topic))) {
            state.queue.push({ did: crypto.randomUUID(), service, path: s.path, event: ev, attempts: 0, nextAt: Date.now() });
            n++;
        }
    }
    persist();
    return { id: ev.id, deliveries: n };
}

async function deliver(d) {
    try {
        const r = await call(d.service, { method: 'POST', path: d.path, body: d.event, retries: 0, timeout: 3000 });
        if (r.status < 200 || r.status >= 300) throw new Error('HTTP ' + r.status);
        state.queue = state.queue.filter((x) => x !== d);
        delivered++;
    } catch (e) {
        d.attempts++;
        d.lastError = String(e.message || e);
        if (d.attempts >= MAX_ATTEMPTS) {
            state.queue = state.queue.filter((x) => x !== d);
            state.dlq.push({ ...d, failedAt: new Date().toISOString() });
            log(`✗ Chuyển dead-letter: ${d.event.topic} -> ${d.service} (${d.lastError})`);
        } else {
            d.nextAt = Date.now() + Math.min(30000, RETRY_BASE_MS * 2 ** d.attempts);
        }
    } finally {
        d.inflight = false;
        inflight--;
        persist();
    }
}

setInterval(() => {
    const now = Date.now();
    for (const d of state.queue) {
        if (inflight >= MAX_INFLIGHT) break;
        if (!d.inflight && d.nextAt <= now) {
            d.inflight = true;
            inflight++;
            deliver(d);
        }
    }
}, 200).unref();

const server = http.createServer(async (req, res) => {
    try {
        const p = new URL(req.url, 'http://x').pathname;
        if (p === '/health') return send(res, 200, { status: 'UP', service: 'event-bus' });
        if (!guardInternal(req, res)) return;

        if (req.method === 'POST' && p === '/publish') {
            const b = await readJson(req);
            if (!b.topic) return send(res, 400, { message: 'Thiếu topic' });
            const ev = {
                id: b.id || crypto.randomUUID(), topic: b.topic, payload: b.payload || {},
                source: b.source || 'unknown', ts: b.ts || new Date().toISOString()
            };
            return send(res, 202, publish(ev));
        }

        if (req.method === 'POST' && p === '/subscribe') {
            const b = await readJson(req);
            if (!b.service || !Array.isArray(b.topics) || !b.topics.length) {
                return send(res, 400, { message: 'Cần service và topics' });
            }
            const next = { topics: b.topics, path: b.path || '/events' };
            const old = state.subs[b.service];
            state.subs[b.service] = next;
            if (!old || JSON.stringify(old) !== JSON.stringify(next)) { log(`+ subscriber ${b.service}: ${b.topics.join(', ')}`); persist(); }
            return send(res, 200, { ok: true });
        }

        if (req.method === 'GET' && p === '/stats') {
            return send(res, 200, {
                subscribers: state.subs, pending: state.queue.length,
                deadLetters: state.dlq.length, delivered
            });
        }

        if (req.method === 'GET' && p === '/dead-letters') return send(res, 200, { deadLetters: state.dlq });

        const m = p.match(/^\/dead-letters\/([^/]+)\/retry$/);
        if (req.method === 'POST' && m) {
            const i = state.dlq.findIndex((d) => d.did === m[1]);
            if (i < 0) return send(res, 404, { message: 'Không tìm thấy' });
            const [d] = state.dlq.splice(i, 1);
            state.queue.push({ ...d, attempts: 0, nextAt: Date.now(), failedAt: undefined });
            persist();
            return send(res, 200, { ok: true });
        }

        send(res, 404, { message: 'Not found' });
    } catch (e) {
        send(res, e.status || 500, { message: e.message });
    }
});

server.listen(PORT, () => log(`Event Bus chạy tại http://localhost:${PORT}`));
function stop() { clearTimeout(saveTimer); save(); process.exit(0); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
