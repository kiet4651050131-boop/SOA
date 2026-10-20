// Kết nối MySQL cho từng dịch vụ (mỗi dịch vụ một database riêng). Tự chờ MySQL và tự tạo bảng.
const mysql = require('mysql2/promise');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function initDatabase({ name, schema = [] }, log = console.log) {
    const base = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: Number(process.env.DB_PORT || 3306)
    };

    let delay = 1000;
    for (;;) {
        try {
            const conn = await mysql.createConnection(base);
            await conn.query(
                `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
            );
            await conn.end();
            break;
        } catch (e) {
            log(`MySQL chưa sẵn sàng (${e.code || e.message}), thử lại sau ${delay}ms`);
            await sleep(delay);
            delay = Math.min(delay * 2, 15000);
        }
    }

    const pool = mysql.createPool({
        ...base,
        database: name,
        waitForConnections: true,
        connectionLimit: 10,
        enableKeepAlive: true,
        dateStrings: true,        // DATE trả về 'YYYY-MM-DD', không bị lệch múi giờ
        charset: 'utf8mb4'
    });

    // Tự thử lại 1 lần khi kết nối bị ngắt giữa chừng
    const rawQuery = pool.query.bind(pool);
    pool.query = async (...args) => {
        try {
            return await rawQuery(...args);
        } catch (e) {
            if (['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'EPIPE'].includes(e.code)) return rawQuery(...args);
            throw e;
        }
    };

    for (const sql of schema) await pool.query(sql);
    log(`Database "${name}" sẵn sàng`);
    return pool;
}

module.exports = { initDatabase };
