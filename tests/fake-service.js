// Dịch vụ giả (chỉ dùng cho kiểm thử hạ tầng): đăng ký registry thật, trả dữ liệu mẫu, ghi nhận sự kiện.
require('../shared/env');
const http = require('http');
const { startRegistration } = require('../shared/registrar');
const { subscribe } = require('../shared/events');
const { readJson, send, guardInternal } = require('../shared/httpx');

const name = process.env.FAKE_NAME;
const port = Number(process.env.PORT);
let failLeft = Number(process.env.FAIL_FIRST || 0);
const received = [];

const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/health') return send(res, 200, { status: 'UP' });
    if (!guardInternal(req, res)) return;
    if (p === '/openapi.json') return send(res, 200, { openapi: '3.0.3', info: { title: name, version: '9.9' }, paths: { [`/api/${name}`]: { get: { summary: 'fake' } } } });
    if (p === '/events') {
        const ev = await readJson(req);
        if (failLeft > 0) { failLeft--; return send(res, 500, { message: 'cố ý lỗi' }); }
        received.push(ev);
        return send(res, 200, { success: true });
    }
    if (p === '/received') return send(res, 200, { received });
    if (p === '/api/auth/login') return send(res, 200, { success: true, instance: port });
    const m = p.match(/^\/api\/(students|topics|registrations)$/);
    if (m) {
        const data = m[1] === 'registrations'
            ? [{ TrangThai: 'Cho duyet' }, { TrangThai: 'Cho duyet' }, { TrangThai: 'Da duyet' }]
            : [{}, {}];
        const who = req.headers['x-user'] ? JSON.parse(Buffer.from(req.headers['x-user'], 'base64').toString()) : null;
        return send(res, 200, { success: true, data, instance: port, method: req.method, user: who });
    }
    send(res, 404, { message: 'nf' });
});
server.listen(port, () => {
    startRegistration({ name, url: `http://localhost:${port}` });
    if (process.env.SUBSCRIBE) subscribe(name, process.env.SUBSCRIBE.split(','), '/events');
});
