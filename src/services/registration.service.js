const pool = require('../config/database');

// Lấy tất cả đăng ký.
async function getAllRegistrations() {
    const [rows] = await pool.query(`
        SELECT 
            DANGKY.MaDK,
            DANGKY.MaSV,
            SINHVIEN.HoTen,
            DANGKY.MaDT,
            DETAI.TenDT,
            DANGKY.NgayDangKy,
            DANGKY.TrangThai,
            DANGKY.Diem
        FROM DANGKY
        INNER JOIN SINHVIEN
            ON DANGKY.MaSV = SINHVIEN.MaSV
        INNER JOIN DETAI
            ON DANGKY.MaDT = DETAI.MaDT
        ORDER BY DANGKY.MaDK
    `);

    return rows;
}

// Lấy đăng ký theo mã.
async function getRegistrationById(maDK) {
    const [rows] = await pool.query(`
        SELECT 
            DANGKY.MaDK,
            DANGKY.MaSV,
            SINHVIEN.HoTen,
            DANGKY.MaDT,
            DETAI.TenDT,
            DANGKY.NgayDangKy,
            DANGKY.TrangThai,
            DANGKY.Diem
        FROM DANGKY
        INNER JOIN SINHVIEN
            ON DANGKY.MaSV = SINHVIEN.MaSV
        INNER JOIN DETAI
            ON DANGKY.MaDT = DETAI.MaDT
        WHERE DANGKY.MaDK = ?
    `, [maDK]);

    return rows[0];
}

// Thêm đăng ký
async function createRegistration(registration) {
    const {
        MaSV,
        MaDT,
        NgayDangKy,
        TrangThai,
        Diem
    } = registration;

    const [result] = await pool.query(
        `INSERT INTO DANGKY
        (MaSV, MaDT, NgayDangKy, TrangThai, Diem)
        VALUES (?, ?, ?, ?, ?)`,
        [MaSV, MaDT, NgayDangKy, TrangThai, Diem]
    );

    return result;
}

// Cập nhật đăng ký
async function updateRegistration(maDK, registration) {
    const {
        MaSV,
        MaDT,
        NgayDangKy,
        TrangThai,
        Diem
    } = registration;

    const [result] = await pool.query(
        `UPDATE DANGKY
         SET MaSV = ?,
             MaDT = ?,
             NgayDangKy = ?,
             TrangThai = ?,
             Diem = ?
         WHERE MaDK = ?`,
        [MaSV, MaDT, NgayDangKy, TrangThai, Diem, maDK]
    );

    return result;
}

// Xóa đăng ký
async function deleteRegistration(maDK) {
    const [result] = await pool.query(
        'DELETE FROM DANGKY WHERE MaDK = ?',
        [maDK]
    );

    return result;
}

module.exports = {
    getAllRegistrations,
    getRegistrationById,
    createRegistration,
    updateRegistration,
    deleteRegistration
};
