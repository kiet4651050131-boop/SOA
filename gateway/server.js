// API GATEWAY – cổng vào duy nhất của hệ thống.
//  - Định tuyến /api/* tới dịch vụ theo TÊN (dò tìm động qua registry, failover giữa các instance)
//  - Thực thi CHÍNH SÁCH trong config/policies.json: xác thực JWT, phân quyền theo vai trò, rate limit, CORS
//  - Tổng hợp dịch vụ (dashboard), tổng hợp tài liệu API, xem trạng thái hệ thống
//  - Phục vụ giao diện web trong thư mục public/
require('../shared/env');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT, jwtSecret, registryUrl, busUrl } = require('../shared/env');
const { readBody, readJson, send } = require('../shared/httpx');
const jwt = require('../shared/jwt');
const { call, internalFetch } = require('../shared/client');
const { startRegistration } = require('../shared/registrar');
const log = require('../shared/log')('gateway');

const PORT = Number(process.env.GATEWAY_PORT || 3000);
const POLICY_FILE = process.env.POLICY_FILE || path.join(ROOT, 'config', 'policies.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SECRET = jwtSecret();

// ---------- Quản lý chính sách (tự nạp lại khi file đổi) ----------
let policies = null;
function loadPolicies() {
    try {
        const p = JSON.parse(fs.readFileSync(POLICY_FILE, 'utf8'));
        if (!Array.isArray(p.routes)) throw new Error('thiếu mảng routes');
        policies = p;
        log(`Đã nạp chính sách (${p.routes.length} route)`);
    } catch (e) {
        log('Chính sách lỗi, giữ bản cũ:', e.message);
        if (!policies) process.exit(1);
    }
}
loadPolicies();
fs.watchFile(POLICY_FILE, { interval: 1500 }, loadPolicies);

function findRoute(p) {
    let best = null;
    for (const r of policies.routes) {
        const pre = r.prefix;
        if (p === pre || p.startsWith(pre.endsWith('/') ? pre : pre + '/')) {
            if (!best || pre.length > best.prefix.length) best = r;
        }
    }
    return best;
}
const findRule = (route, method) => route.rules.find((r) => r.methods.includes('*') || r.methods.includes(method));

// ---------- Rate limit (cửa sổ cố định, trong bộ nhớ) ----------
const buckets = new Map();
function hit(key, { windowMs, max }) {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) { b = { count: 0, resetAt: now + windowMs }; buckets.set(key, b); }
    b.count++;
    return { ok: b.count <= max, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
}
setInterval(() => { const n = Date.now(); for (const [k, b] of buckets) if (b.resetAt <= n) buckets.delete(k); }, 60000).unref();

// ---------- Tiện ích ----------
function authenticate(req) {
    const h = req.headers['authorization'];
    if (!h) return { error: 'Chưa đăng nhập' };
    const [scheme, token] = h.split(' ');
    if (scheme !== 'Bearer' || !token) return { error: 'Token không hợp lệ' };
    try {
        return { user: jwt.verify(token, SECRET) };
    } catch {
        return { error: 'Token hết hạn hoặc không hợp lệ' };
    }
}

function corsHeaders(req) {
    const origins = (policies.cors && policies.cors.origins) || [];
    const origin = req.headers.origin;
    let allow = null;
    if (origins.includes('*')) allow = '*';
    else if (origin && origins.includes(origin)) allow = origin;
    return allow ? {
        'access-control-allow-origin': allow,
        'access-control-allow-headers': 'Authorization, Content-Type',
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
        vary: 'Origin'
    } : {};
}

const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function serveStatic(req, res, pathname) {
    let rel = decodeURIComponent(pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        return send(res, 404, { success: false, message: 'Không tìm thấy' });
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
}

function unavailable(res, e, extra = {}) {
    send(res, 503, {
        success: false,
        message: `Dịch vụ "${e.service || 'hệ thống'}" tạm thời không khả dụng, vui lòng thử lại sau ít phút`,
        service: e.service, ...extra
    }, { 'retry-after': '5' });
}

const userHeader = (u) => Buffer.from(JSON.stringify({ MaTK: u.MaTK, TenDangNhap: u.TenDangNhap, VaiTro: u.VaiTro })).toString('base64');

// ---------- Các endpoint do gateway tự xử lý ----------
async function registryServices() {
    const r = await internalFetch(`${registryUrl()}/services`);
    return (await r.json()).services;
}

async function handleSystem(req, res, pathname, user) {
    if (pathname === '/api/system/services') {
        let services = null, bus = null;
        try { services = await registryServices(); } catch { /* registry sập */ }
        try { bus = await (await internalFetch(`${busUrl()}/stats`)).json(); } catch { /* bus sập */ }
        return send(res, 200, { success: true, data: { registry: services ? 'UP' : 'DOWN', services: services || {}, eventBus: bus } });
    }

    if (pathname === '/api/system/policies') {
        if (user.VaiTro !== 'giangvien') return send(res, 403, { success: false, message: 'Chỉ giảng viên được xem/sửa chính sách' });
        if (req.method === 'GET') return send(res, 200, { success: true, data: policies });
        if (req.method === 'PUT') {
            const b = await readJson(req);
            const ok = Array.isArray(b.routes) && b.routes.every((r) => r.prefix && r.service && Array.isArray(r.rules));
            if (!ok) return send(res, 400, { success: false, message: 'Chính sách không hợp lệ' });
            // Thiếu phần nào thì giữ nguyên bản đang chạy (tránh làm sập gateway vì thiếu limits)
            const g = b.limits && b.limits.global;
            if (!g || !(g.windowMs > 0) || !(g.max > 0)) b.limits = { ...policies.limits, ...(b.limits || {}), global: policies.limits.global };
            if (!b.limits.bodyBytes) b.limits.bodyBytes = policies.limits.bodyBytes;
            if (!b.cors) b.cors = policies.cors;
            if (!b.version) b.version = policies.version || 1;
            fs.writeFileSync(POLICY_FILE, JSON.stringify(b, null, 2));
            loadPolicies();
            return send(res, 200, { success: true, message: 'Đã cập nhật chính sách' });
        }
    }

    if (pathname === '/api/dashboard' && req.method === 'GET') {
        // Dịch vụ tổng hợp (service composition): gom dữ liệu từ 3 dịch vụ, chịu lỗi từng phần
        const get = async (service, p) => {
            const r = await call(service, { path: p, retries: 1 });
            if (r.status !== 200) throw new Error('HTTP ' + r.status);
            return r.json().data;
        };
        const [s, t, r] = await Promise.allSettled([
            get('student-service', '/api/students'),
            get('topic-service', '/api/topics'),
            get('registration-service', '/api/registrations')
        ]);
        const byStatus = {};
        if (r.status === 'fulfilled') for (const x of r.value) byStatus[x.TrangThai || 'Chưa rõ'] = (byStatus[x.TrangThai || 'Chưa rõ'] || 0) + 1;
        const degraded = [['student-service', s], ['topic-service', t], ['registration-service', r]]
            .filter(([, v]) => v.status === 'rejected').map(([n]) => n);
        return send(res, 200, {
            success: true,
            data: {
                students: s.status === 'fulfilled' ? s.value.length : null,
                topics: t.status === 'fulfilled' ? t.value.length : null,
                registrations: r.status === 'fulfilled' ? r.value.length : null,
                registrationsByStatus: byStatus, degraded
            }
        });
    }
    return send(res, 404, { success: false, message: 'Không tìm thấy' });
}

async function collectDocs() {
    const services = await registryServices();
    const paths = {};
    const listing = [];
    for (const [name, list] of Object.entries(services)) {
        if (name === 'api-gateway' || !list.some((i) => i.status === 'UP')) continue;
        try {
            const r = await call(name, { path: '/openapi.json', retries: 0 });
            const doc = r.json();
            Object.assign(paths, doc.paths);
            listing.push({ name, version: doc.info.version, paths: doc.paths });
        } catch { /* bỏ qua dịch vụ không trả lời */ }
    }
    return { paths, listing };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function handleDocs(req, res, pathname) {
    const { paths, listing } = await collectDocs();
    if (pathname === '/api-docs.json') {
        return send(res, 200, {
            openapi: '3.0.3',
            info: { title: 'Hệ thống quản lý đồ án tốt nghiệp (SOA)', version: '2.0.0' },
            paths,
            components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }
        });
    }
    let rows = '';
    for (const s of listing) {
        rows += `<h2>${esc(s.name)} <small>v${esc(s.version)}</small></h2><table><tr><th>Method</th><th>Đường dẫn</th><th>Mô tả</th><th>Vai trò</th></tr>`;
        for (const [p, ops] of Object.entries(s.paths)) {
            for (const [m, op] of Object.entries(ops)) {
                rows += `<tr><td>${esc(m.toUpperCase())}</td><td><code>${esc(p)}</code></td><td>${esc(op.summary || '')}</td><td>${esc((op['x-roles'] || []).join(', '))}</td></tr>`;
            }
        }
        rows += '</table>';
    }
    const html = `<!doctype html><meta charset="utf-8"><title>API Docs</title>
<style>body{font-family:Arial;margin:30px auto;max-width:1000px;color:#333}table{border-collapse:collapse;width:100%;margin-bottom:20px}
td,th{border:1px solid #dce2e8;padding:6px 10px;text-align:left}th{background:#eef4f8}small{color:#888}</style>
<h1>Tài liệu API (tổng hợp từ các dịch vụ đang chạy)</h1><p>Dữ liệu OpenAPI: <a href="/api-docs.json">/api-docs.json</a></p>${rows || '<p>Chưa có dịch vụ nào đăng ký.</p>'}`;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
}

// ---------- Vòng xử lý request ----------
const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const rid = crypto.randomUUID();
    const ip = req.socket.remoteAddress || 'unknown';
    const pathname = new URL(req.url, 'http://x').pathname;
    let who = '-';

    res.on('finish', () => {
        if (pathname.startsWith('/api')) log(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - started}ms user=${who}`);
    });

    const cors = corsHeaders(req);
    const origWriteHead = res.writeHead.bind(res);
    res.writeHead = (status, headers = {}) => origWriteHead(status, {
        ...cors, 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'x-request-id': rid, ...headers
    });

    try {
        if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

        const g = hit(`global|${ip}`, policies.limits.global);
        if (!g.ok) return send(res, 429, { success: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau' }, { 'retry-after': String(g.retryAfter) });

        if (pathname === '/health') {
            return send(res, 200, { status: 'UP', service: 'api-gateway', uptime: Math.round(process.uptime()) });
        }
        if (pathname === '/api-docs' || pathname === '/api-docs.json') return await handleDocs(req, res, pathname);

        if (!pathname.startsWith('/api/')) {
            if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { success: false, message: 'Method không được hỗ trợ' });
            return serveStatic(req, res, pathname);
        }

        // Endpoint do gateway tự xử lý
        if (pathname.startsWith('/api/system/') || pathname === '/api/dashboard') {
            const a = authenticate(req);
            if (a.error) return send(res, 401, { success: false, message: a.error });
            who = a.user.TenDangNhap;
            return await handleSystem(req, res, pathname, a.user);
        }

        // Định tuyến theo chính sách
        const route = findRoute(pathname);
        if (!route) return send(res, 404, { success: false, message: 'Không tìm thấy API' });
        const rule = findRule(route, req.method);
        if (!rule) return send(res, 405, { success: false, message: 'Method không được hỗ trợ' });

        if (rule.rateLimit) {
            const l = hit(`${route.prefix}|${ip}`, rule.rateLimit);
            if (!l.ok) return send(res, 429, { success: false, message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau' }, { 'retry-after': String(l.retryAfter) });
        }

        let user = null;
        if (rule.auth !== false) {
            const a = authenticate(req);
            if (a.error) return send(res, 401, { success: false, message: a.error });
            user = a.user;
            who = user.TenDangNhap;
            const roles = rule.roles || ['*'];
            if (!roles.includes('*') && !roles.includes(user.VaiTro)) {
                return send(res, 403, { success: false, message: 'Bạn không có quyền thực hiện thao tác này' });
            }
        }

        const body = (req.method === 'GET' || req.method === 'HEAD') ? undefined : await readBody(req, policies.limits.bodyBytes);
        const fwd = { 'x-request-id': rid, 'x-forwarded-for': ip };
        if (req.headers['content-type']) fwd['content-type'] = req.headers['content-type'];
        if (user) fwd['x-user'] = userHeader(user);

        try {
            const r = await call(route.service, {
                method: req.method, path: req.url, headers: fwd,
                body: body && body.length ? body : undefined, retries: 2
            });
            const h = { 'content-type': r.headers['content-type'] || 'application/json' };
            for (const k of ['x-degraded', 'location']) if (r.headers[k]) h[k] = r.headers[k];
            res.writeHead(r.status, { ...h, 'content-length': r.buffer.length });
            res.end(r.buffer);
        } catch (e) {
            if (e.status === 503) return unavailable(res, e);
            throw e;
        }
    } catch (e) {
        if (e.status === 413 || e.status === 400) return send(res, e.status, { success: false, message: e.message });
        if (e.status === 503) return unavailable(res, e);
        log('Lỗi gateway:', e.message);
        if (!res.headersSent) send(res, 500, { success: false, message: 'Lỗi hệ thống' });
    }
});

server.listen(PORT, () => {
    log(`API Gateway chạy tại http://localhost:${PORT}`);
    registration = startRegistration({ name: 'api-gateway', url: process.env.SERVICE_URL || `http://${process.env.SERVICE_HOST || 'localhost'}:${PORT}`, log });
});
let registration;
async function shutdown() {
    if (registration) await registration.stop();
    server.close();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (e) => { log('uncaughtException:', e); process.exit(1); });
