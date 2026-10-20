// Nạp file .env ở thư mục gốc (không cần thư viện dotenv) và cung cấp cấu hình dùng chung.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

function loadEnv(file) {
    if (!fs.existsSync(file)) return;
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const i = line.indexOf('=');
        if (i < 1) continue;
        const key = line.slice(0, i).trim();
        let val = line.slice(i + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
    }
}

loadEnv(path.join(ROOT, '.env'));

function jwtSecret() {
    const s = process.env.JWT_SECRET;
    if (!s) throw new Error('Thiếu JWT_SECRET trong file .env');
    return s;
}

// Khóa nội bộ: chỉ gateway/dịch vụ trong hệ thống biết, dùng để chặn gọi vòng qua gateway.
function internalKey() {
    return process.env.INTERNAL_KEY ||
        crypto.createHash('sha256').update('internal:' + jwtSecret()).digest('hex');
}

const registryUrl = () => (process.env.REGISTRY_URL || 'http://localhost:3500').replace(/\/$/, '');
const busUrl = () => (process.env.EVENT_BUS_URL || 'http://localhost:3600').replace(/\/$/, '');

module.exports = { ROOT, jwtSecret, internalKey, registryUrl, busUrl };
