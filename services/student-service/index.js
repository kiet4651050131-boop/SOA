// STUDENT SERVICE – quản lý sinh viên (database riêng: soa_student)
const express = require('express');
const { createService, HttpError } = require('../../shared/service-base');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

createService({
    name: 'student-service',
    port: 3002,
    db: {
        name: process.env.DB_NAME_STUDENT || 'soa_student',
        schema: [`CREATE TABLE IF NOT EXISTS SINHVIEN (
            MaSV VARCHAR(20) NOT NULL PRIMARY KEY,
            HoTen VARCHAR(100) NOT NULL,
            Email VARCHAR(100) NULL,
            Lop VARCHAR(50) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`]
    },
    openapi: {
        description: 'Dịch vụ quản lý sinh viên',
        routes: [
            { method: 'GET', path: '/api/students', summary: 'Danh sách sinh viên (lọc theo ?ids=SV001,SV002)', query: ['ids'] },
            { method: 'GET', path: '/api/students/:id', summary: 'Chi tiết sinh viên' },
            { method: 'POST', path: '/api/students', summary: 'Thêm sinh viên', roles: ['giangvien'], body: ['MaSV', 'HoTen', 'Email', 'Lop'], required: ['MaSV', 'HoTen'] },
            { method: 'PUT', path: '/api/students/:id', summary: 'Cập nhật sinh viên', roles: ['giangvien'], body: ['HoTen', 'Email', 'Lop'], required: ['HoTen'] },
            { method: 'DELETE', path: '/api/students/:id', summary: 'Xóa sinh viên (phát sự kiện student.deleted)', roles: ['giangvien'] }
        ]
    },
    async init(app, { pool, publish }) {
        const router = express.Router();

        router.get('/', async (req, res) => {
            let rows;
            if (req.query.ids !== undefined) {
                const ids = String(req.query.ids).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 500);
                rows = ids.length ? (await pool.query('SELECT * FROM SINHVIEN WHERE MaSV IN (?)', [ids]))[0] : [];
            } else {
                [rows] = await pool.query('SELECT * FROM SINHVIEN ORDER BY MaSV');
            }
            res.json({ success: true, data: rows });
        });

        router.get('/:id', async (req, res) => {
            const [rows] = await pool.query('SELECT * FROM SINHVIEN WHERE MaSV = ?', [req.params.id]);
            if (!rows[0]) throw new HttpError(404, 'Không tìm thấy sinh viên');
            res.json({ success: true, data: rows[0] });
        });

        router.post('/', async (req, res) => {
            const { MaSV, HoTen, Email, Lop } = req.body || {};
            if (!MaSV || !HoTen) throw new HttpError(400, 'Mã sinh viên và họ tên là bắt buộc');
            if (Email && !EMAIL_RE.test(Email)) throw new HttpError(400, 'Email không hợp lệ');
            try {
                await pool.query('INSERT INTO SINHVIEN (MaSV, HoTen, Email, Lop) VALUES (?, ?, ?, ?)',
                    [MaSV, HoTen, Email || null, Lop || null]);
            } catch (e) {
                if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Mã sinh viên đã tồn tại');
                throw e;
            }
            publish('student.created', { MaSV, HoTen });
            res.status(201).json({ success: true, message: 'Thêm sinh viên thành công' });
        });

        router.put('/:id', async (req, res) => {
            const { HoTen, Email, Lop } = req.body || {};
            if (!HoTen) throw new HttpError(400, 'Họ tên là bắt buộc');
            if (Email && !EMAIL_RE.test(Email)) throw new HttpError(400, 'Email không hợp lệ');
            const [r] = await pool.query('UPDATE SINHVIEN SET HoTen = ?, Email = ?, Lop = ? WHERE MaSV = ?',
                [HoTen, Email || null, Lop || null, req.params.id]);
            if (r.affectedRows === 0) throw new HttpError(404, 'Không tìm thấy sinh viên');
            res.json({ success: true, message: 'Cập nhật sinh viên thành công' });
        });

        router.delete('/:id', async (req, res) => {
            const [r] = await pool.query('DELETE FROM SINHVIEN WHERE MaSV = ?', [req.params.id]);
            if (r.affectedRows === 0) throw new HttpError(404, 'Không tìm thấy sinh viên');
            // Không dùng khóa ngoại/cascade giữa các DB: báo cho dịch vụ khác biết bằng sự kiện
            publish('student.deleted', { MaSV: req.params.id });
            res.json({ success: true, message: 'Xóa sinh viên thành công' });
        });

        app.use('/api/students', router);
    }
});
