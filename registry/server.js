// SERVICE REGISTRY – dò tìm dịch vụ động.
// Dịch vụ tự đăng ký + heartbeat; registry chủ động kiểm tra /health và loại instance hỏng khỏi kết quả tra cứu.
require('../shared/env');
const http = require('http');
const crypto = require('crypto');
const { readJson, send, guardInternal } = require('../shared/httpx');
const log = require('../shared/log')('registry');

const PORT = Number(process.env.REGISTRY_PORT || 3500);
const TTL = Number(process.env.REGISTRY_TTL_MS || 15000);        // quá hạn heartbeat => STALE
const SWEEP = Number(process.env.REGISTRY_SWEEP_MS || 5000);     // chu kỳ kiểm tra sức khỏe
const REMOVE_AFTER = TTL * 4;                                    // quá lâu không heartbeat => xóa

const instances = new Map();
const idOf = (name, url) => crypto.createHash('sha1').update(`${name}|${url}`).digest('hex').slice(0, 12);

function view(i) {
    const stale = Date.now() - i.lastHeartbeat > TTL;
    const status = stale ? 'STALE' : i.health;            // UP | UNHEALTHY | STALE
    return {
        id: i.id, name: i.name, url: i.url, version: i.version, metadata: i.metadata,
        status, lastHeartbeatAgoMs: Date.now() - i.lastHeartbeat,
        uptimeMs: Date.now() - i.registeredAt
    };
}

const server = http.createServer(async (req, res) => {
    try {
        const p = new URL(req.url, 'http://x').pathname;
        if (p === '/health') return send(res, 200, { status: 'UP', service: 'registry', instances: instances.size });
        if (!guardInternal(req, res)) return;

        if (req.method === 'POST' && p === '/register') {
            const b = await readJson(req);
            if (!b.name || !b.url) return send(res, 400, { message: 'Cần name và url' });
            const url = String(b.url).replace(/\/$/, '');
            const id = idOf(b.name, url);
            const prev = instances.get(id);
            instances.set(id, {
                id, name: b.name, url, version: b.version || '1.0.0', metadata: b.metadata || {},
                registeredAt: prev ? prev.registeredAt : Date.now(),
                lastHeartbeat: Date.now(), health: prev ? prev.health : 'UP', failures: 0
            });
            if (!prev) log(`+ ${b.name} @ ${url}`);
            return send(res, 200, { instanceId: id });
        }

        let m = p.match(/^\/heartbeat\/([^/]+)$/);
        if (req.method === 'PUT' && m) {
            const i = instances.get(m[1]);
            if (!i) return send(res, 404, { message: 'Instance chưa đăng ký' });
            i.lastHeartbeat = Date.now();
            return send(res, 200, { ok: true });
        }

        m = p.match(/^\/instances\/([^/]+)$/);
        if (req.method === 'DELETE' && m) {
            const i = instances.get(m[1]);
            if (i) { instances.delete(m[1]); log(`- ${i.name} @ ${i.url} (hủy đăng ký)`); }
            return send(res, 200, { ok: true });
        }

        if (req.method === 'GET' && p === '/services') {
            const services = {};
            for (const i of instances.values()) (services[i.name] = services[i.name] || []).push(view(i));
            return send(res, 200, { services });
        }

        m = p.match(/^\/services\/([^/]+)$/);
        if (req.method === 'GET' && m) {
            const name = decodeURIComponent(m[1]);
            const list = [...instances.values()].filter((i) => i.name === name).map(view).filter((v) => v.status === 'UP');
            return send(res, 200, { name, instances: list });
        }

        send(res, 404, { message: 'Not found' });
    } catch (e) {
        send(res, e.status || 500, { message: e.message });
    }
});

async function sweep() {
    const now = Date.now();
    await Promise.all([...instances.values()].map(async (i) => {
        if (now - i.lastHeartbeat > REMOVE_AFTER) {
            instances.delete(i.id);
            log(`- ${i.name} @ ${i.url} (mất heartbeat, đã loại)`);
            return;
        }
        if (now - i.lastHeartbeat > TTL) return;
        try {
            const r = await fetch(i.url + '/health', { signal: AbortSignal.timeout(1500) });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            if (i.health !== 'UP') log(`✓ ${i.name} @ ${i.url} khỏe trở lại`);
            i.health = 'UP';
            i.failures = 0;
        } catch {
            i.failures++;
            if (i.failures >= 2 && i.health !== 'UNHEALTHY') {
                i.health = 'UNHEALTHY';
                log(`! ${i.name} @ ${i.url} không khỏe, tạm loại khỏi định tuyến`);
            }
        }
    }));
}
setInterval(sweep, SWEEP).unref();

server.listen(PORT, () => log(`Service Registry chạy tại http://localhost:${PORT}`));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
