// Kiểm tra kết nối MySQL theo .env và (tuỳ chọn) đặt lại tài khoản giảng viên (tài khoản gốc tạo từ .env).
//   node scripts/check-db.js              -> liệt kê database + tài khoản trong soa_auth
//   node scripts/check-db.js reset-admin  -> xoá các tài khoản giảng viên/admin cũ (khởi động lại hệ thống để tạo lại theo .env)
require('../shared/env');
const mysql = require('mysql2/promise');

(async () => {
    const c = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });
    const [[info]] = await c.query('SELECT @@port AS port, @@version AS version');
    console.log('Đã kết nối MySQL: cổng', info.port, '| phiên bản', info.version);

    const [dbs] = await c.query('SHOW DATABASES');
    console.log('Các database:', dbs.map((d) => d.Database).join(', '));

    const [has] = await c.query("SHOW DATABASES LIKE 'soa_auth'");
    if (!has.length) {
        console.log('-> Chưa có soa_auth. Hãy chạy npm start một lần để hệ thống tự tạo.');
        return c.end();
    }
    if (process.argv[2] === 'reset-admin') {
        const [r] = await c.query("DELETE FROM soa_auth.TAIKHOAN WHERE VaiTro IN ('admin', 'giangvien')");
        console.log('Đã xoá', r.affectedRows, 'tài khoản. Bây giờ tắt và chạy lại npm start để tạo lại theo .env.');
    } else {
        const [u] = await c.query('SELECT MaTK, TenDangNhap, VaiTro FROM soa_auth.TAIKHOAN');
        console.log('Tài khoản trong soa_auth:', u);
    }
    await c.end();
})().catch((e) => { console.error('Lỗi:', e.code || e.message); process.exit(1); });
