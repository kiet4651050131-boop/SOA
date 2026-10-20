// Phía dịch vụ của Event Bus: publish bất đồng bộ (có outbox tự gửi lại) và subscribe.
const crypto = require('crypto');
const { busUrl, internalKey } = require('./env');

const outbox = [];
let flushing = false;
let retryTimer = null;

function post(path, body) {
    return fetch(busUrl() + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-key': internalKey() },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2000)
    });
}

async function flush() {
    if (flushing) return;
    flushing = true;
    try {
        while (outbox.length) {
            const r = await post('/publish', outbox[0]);
            if (r.status >= 500) throw new Error('bus ' + r.status);
            outbox.shift();               // 2xx hoặc 4xx (sự kiện sai) -> bỏ khỏi outbox
        }
    } catch {
        clearTimeout(retryTimer);         // bus đang sập: giữ trong outbox, thử lại sau
        retryTimer = setTimeout(flush, 2000);
    } finally {
        flushing = false;
    }
}

/** Không chặn luồng xử lý: ném sự kiện vào outbox rồi trả về ngay. */
function publish(topic, payload = {}, source = 'unknown') {
    outbox.push({ id: crypto.randomUUID(), topic, payload, source, ts: new Date().toISOString() });
    if (outbox.length > 1000) outbox.shift();
    flush();
}

/** Đăng ký nhận sự kiện; lặp lại định kỳ để tự phục hồi khi bus mất dữ liệu. */
function subscribe(service, topics, path = '/events', log = console.log) {
    let ok = false;
    async function once() {
        try {
            const r = await post('/subscribe', { service, topics, path });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            if (!ok) log(`Đã subscribe event bus: ${topics.join(', ')}`);
            ok = true;
        } catch {
            ok = false;
        }
        setTimeout(once, ok ? 15000 : 2000).unref();
    }
    once();
}

module.exports = { publish, subscribe };
