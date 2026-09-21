const pool = require('../config/database');

// Lấy tất cả đề tài
async function getAllTopics() {
    const [rows] = await pool.query(
        'SELECT * FROM DETAI'
    );

    return rows;
}

// Lấy đề tài theo mã
async function getTopicById(maDT) {
    const [rows] = await pool.query(
        'SELECT * FROM DETAI WHERE MaDT = ?',
        [maDT]
    );

    return rows[0];
}

// Thêm đề tài
async function createTopic(topic) {
    const {
        MaDT,
        TenDT,
        MoTa,
        GiangVienHuongDan
    } = topic;

    const [result] = await pool.query(
        `INSERT INTO DETAI
        (MaDT, TenDT, MoTa, GiangVienHuongDan)
        VALUES (?, ?, ?, ?)`,
        [MaDT, TenDT, MoTa, GiangVienHuongDan]
    );

    return result;
}

// Cập nhật đề tài
async function updateTopic(maDT, topic) {
    const {
        TenDT,
        MoTa,
        GiangVienHuongDan
    } = topic;

    const [result] = await pool.query(
        `UPDATE DETAI
         SET TenDT = ?,
             MoTa = ?,
             GiangVienHuongDan = ?
         WHERE MaDT = ?`,
        [TenDT, MoTa, GiangVienHuongDan, maDT]
    );

    return result;
}

// Xóa đề tài
async function deleteTopic(maDT) {
    const [result] = await pool.query(
        'DELETE FROM DETAI WHERE MaDT = ?',
        [maDT]
    );

    return result;
}

module.exports = {
    getAllTopics,
    getTopicById,
    createTopic,
    updateTopic,
    deleteTopic
};