// Tiện ích HTTP thuần (không phụ thuộc Express) cho registry, event bus và gateway.
const { internalKey } = require('./env');

async function readBody(req, limit = 1048576) {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
        size += c.length;
        if (size > limit) {
            const e = new Error('Dữ liệu gửi lên quá lớn');
            e.status = 413;
            throw e;
        }
        chunks.push(c);
    }
    return Buffer.concat(chunks);
}

async function readJson(req, limit) {
    const b = await readBody(req, limit);
    if (!b.length) return {};
    try {
        return JSON.parse(b.toString('utf8'));
    } catch {
        const e = new Error('JSON không hợp lệ');
        e.status = 400;
        throw e;
    }
}

function send(res, status, obj, headers = {}) {
    const body = JSON.stringify(obj);
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body),
        ...headers
    });
    res.end(body);
}

function guardInternal(req, res) {
    if (req.headers['x-internal-key'] !== internalKey()) {
        send(res, 401, { success: false, message: 'Unauthorized' });
        return false;
    }
    return true;
}

module.exports = { readBody, readJson, send, guardInternal };
