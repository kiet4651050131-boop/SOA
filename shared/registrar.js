// Đăng ký dịch vụ với Service Registry, gửi heartbeat, tự đăng ký lại khi registry khởi động lại.
const { registryUrl, internalKey } = require('./env');

const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS || 5000);

async function registryFetch(path, { method = 'GET', body } = {}) {
    return fetch(registryUrl() + path, {
        method,
        headers: { 'content-type': 'application/json', 'x-internal-key': internalKey() },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(2000)
    });
}

function startRegistration({ name, url, version = '1.0.0', metadata = {}, log = console.log }) {
    let instanceId = null;
    let stopped = false;
    let timer = null;
    let warned = false;

    async function register() {
        const r = await registryFetch('/register', { method: 'POST', body: { name, url, version, metadata } });
        if (!r.ok) throw new Error('registry trả về ' + r.status);
        instanceId = (await r.json()).instanceId;
        warned = false;
        log(`Đã đăng ký vào registry: ${name} @ ${url}`);
    }

    async function tick() {
        if (stopped) return;
        try {
            if (!instanceId) {
                await register();
            } else {
                const r = await registryFetch(`/heartbeat/${instanceId}`, { method: 'PUT' });
                if (r.status === 404) {          // registry đã mất dữ liệu (restart) -> đăng ký lại
                    instanceId = null;
                    await register();
                }
            }
        } catch (e) {
            if (!warned) log(`Registry chưa liên lạc được (${e.message}), sẽ tự thử lại`);
            warned = true;
        }
        if (!stopped) timer = setTimeout(tick, instanceId ? HEARTBEAT_MS : 1500);
    }

    tick();

    return {
        async stop() {
            stopped = true;
            clearTimeout(timer);
            if (instanceId) {
                try { await registryFetch(`/instances/${instanceId}`, { method: 'DELETE' }); } catch { /* bỏ qua */ }
            }
        }
    };
}

module.exports = { startRegistration };
