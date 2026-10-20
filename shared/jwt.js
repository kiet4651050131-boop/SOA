// JWT HS256 viết bằng module crypto có sẵn (tương thích token do thư viện jsonwebtoken tạo ra).
const crypto = require('crypto');

const b64u = (v) => Buffer.from(v).toString('base64url');
const hmac = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest();

function sign(payload, secret, expiresInSec = 7200) {
    const now = Math.floor(Date.now() / 1000);
    const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = b64u(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSec }));
    const sig = hmac(`${head}.${body}`, secret).toString('base64url');
    return `${head}.${body}.${sig}`;
}

function verify(token, secret) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw new Error('malformed');
    const [h, p, s] = parts;
    const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256') throw new Error('unsupported alg');
    const expected = hmac(`${h}.${p}`, secret);
    const given = Buffer.from(s, 'base64url');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
        throw new Error('bad signature');
    }
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('expired');
    return payload;
}

module.exports = { sign, verify };
