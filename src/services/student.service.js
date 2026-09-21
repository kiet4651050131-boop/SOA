const pool = require('../config/database');

// Lấy tất cả sinh viên
async function getAllStudents() {
    const [rows] = await pool.query(
        'SELECT * FROM SINHVIEN'
    );

    return rows;
}

// Lấy sinh viên theo mã
async function getStudentById(maSV) {
    const [rows] = await pool.query(
        'SELECT * FROM SINHVIEN WHERE MaSV = ?',
        [maSV]
    );

    return rows[0];
}

// Thêm sinh viên
async function createStudent(student) {
    const { MaSV, HoTen, Email, Lop } = student;

    const [result] = await pool.query(
        `INSERT INTO SINHVIEN
        (MaSV, HoTen, Email, Lop)
        VALUES (?, ?, ?, ?)`,
        [MaSV, HoTen, Email, Lop]
    );

    return result;
}

// Cập nhật sinh viên
async function updateStudent(maSV, student) {
    const { HoTen, Email, Lop } = student;

    const [result] = await pool.query(
        `UPDATE SINHVIEN
         SET HoTen = ?, Email = ?, Lop = ?
         WHERE MaSV = ?`,
        [HoTen, Email, Lop, maSV]
    );

    return result;
}

// Xóa sinh viên
async function deleteStudent(maSV) {
    const [result] = await pool.query(
        'DELETE FROM SINHVIEN WHERE MaSV = ?',
        [maSV]
    );

    return result;
}

module.exports = {
    getAllStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};