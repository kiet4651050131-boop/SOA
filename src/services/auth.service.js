const pool = require('../config/database');

// Tìm tài khoản theo tên đăng nhập
async function findByUsername(username) {
    const [rows] = await pool.query(
        'SELECT * FROM TAIKHOAN WHERE TenDangNhap = ?',
        [username]
    );

    return rows[0];
}

// Tạo tài khoản mới
async function createUser(user) {
    const {
        TenDangNhap,
        MatKhau,
        HoTen,
        Email
    } = user;

    const [result] = await pool.query(
        `INSERT INTO TAIKHOAN
        (TenDangNhap, MatKhau, HoTen, Email)
        VALUES (?, ?, ?, ?)`,
        [TenDangNhap, MatKhau, HoTen, Email]
    );

    return result;
}

module.exports = {
    findByUsername,
    createUser
};