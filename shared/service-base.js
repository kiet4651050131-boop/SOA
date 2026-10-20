// Khung chung cho mọi dịch vụ nghiệp vụ (Express): health, OpenAPI, khóa nội bộ,
// đăng ký registry + heartbeat, subscribe sự kiện, tắt êm (graceful shutdown).
require('./env');
const express = require('express');
const makeLogger = require('./log');
const { internalKey } = require('./env');
const { initDatabase } = require('./db');
const { startRegistration } = require('./registrar');
const { publish, subscribe } = require('./events');
const { call } = require('./client');
const { build: buildOpenApi } = require('./openapi');

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function requireRole(req, ...roles) {
    if (!req.user) throw new HttpError(401, 'Chưa đăng nhập');
    if (!roles.includes(req.user.VaiTro)) throw new HttpError(403, 'Bạn không có quyền thực hiện thao tác này');
}

function createService({ name, port: defaultPort, version = '1.0.0', db, openapi = {}, events, init }) {
    const log = makeLogger(name);
    const port = Number(process.env.PORT || defaultPort);
    const url = process.env.SERVICE_URL || `http://${process.env.SERVICE_HOST || 'localhost'}:${port}`;

    process.on('uncaughtException', (e) => { log('uncaughtException:', e); process.exit(1); }); // supervisor sẽ khởi động lại
    process.on('unhandledRejection', (e) => log('unhandledRejection:', e));

    (async function main() {
        const pool = db ? await initDatabase(db, log) : null;

        const app = express();
        app.disable('x-powered-by');
        app.use(express.json({ limit: '100kb' }));

        // Không cần khóa nội bộ: để registry và docker kiểm tra sức khỏe
        app.get('/health', async (req, res) => {
            try {
                if (pool) await pool.query('SELECT 1');
                res.json({ status: 'UP', service: name, version, uptime: Math.round(process.uptime()) });
            } catch {
                res.status(503).json({ status: 'DOWN', service: name, reason: 'database' });
            }
        });
        app.get('/openapi.json', (req, res) => res.json(buildOpenApi({ title: name, version, ...openapi })));

        // Chỉ nhận request đi qua gateway hoặc từ dịch vụ khác trong hệ thống
        app.use((req, res, next) => {
            if (req.headers['x-internal-key'] !== internalKey()) {
                return res.status(401).json({ success: false, message: 'Chỉ được truy cập qua API Gateway' });
            }
            const raw = req.headers['x-user'];
            if (raw) {
                try { req.user = JSON.parse(Buffer.from(String(raw), 'base64').toString('utf8')); } catch { /* bỏ qua */ }
            }
            next();
        });

        const ctx = { pool, log, publish: (topic, payload) => publish(topic, payload, name), call };

        if (events) {
            app.post('/events', async (req, res) => {
                const ev = req.body || {};
                const handler = events[ev.topic];
                if (handler) await handler(ev.payload || {}, ev, ctx);
                res.json({ success: true });
            });
        }

        await init(app, ctx);

        app.use((req, res) => res.status(404).json({ success: false, message: 'Không tìm thấy tài nguyên' }));
        // eslint-disable-next-line no-unused-vars
        app.use((err, req, res, next) => {
            if (err.type === 'entity.parse.failed') {
                return res.status(400).json({ success: false, message: 'JSON không hợp lệ' });
            }
            if (err.type === 'entity.too.large' || err.status === 413) {
                return res.status(413).json({ success: false, message: 'Dữ liệu gửi lên quá lớn' });
            }
            if (err instanceof HttpError) {
                return res.status(err.status).json({ success: false, message: err.message });
            }
            log('Lỗi:', err.message);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống, vui lòng thử lại' });
        });

        let registration;
        const server = app.listen(port, () => {
            log(`Đang chạy tại ${url}`);
            registration = startRegistration({ name, url, version, log });
            if (events) subscribe(name, Object.keys(events), '/events', log);
        });
        server.on('error', (e) => { log('Không mở được cổng', port, e.code); process.exit(1); });

        let closing = false;
        async function shutdown() {
            if (closing) return;
            closing = true;
            log('Đang tắt...');
            if (registration) await registration.stop();
            server.close();
            if (pool) await pool.end().catch(() => {});
            process.exit(0);
        }
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    })().catch((e) => { log('Khởi động thất bại:', e); process.exit(1); });
}

module.exports = { createService, HttpError, requireRole };
