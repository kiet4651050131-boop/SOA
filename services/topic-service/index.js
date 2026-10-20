// TOPIC SERVICE – quản lý đề tài (database riêng: soa_topic)
const express = require('express');
const { createService, HttpError } = require('../../shared/service-base');

createService({
    name: 'topic-service',
    port: 3003,
    db: {
        name: process.env.DB_NAME_TOPIC || 'soa_topic',
        schema: [`CREATE TABLE IF NOT EXISTS DETAI (
            MaDT VARCHAR(20) NOT NULL PRIMARY KEY,
            TenDT VARCHAR(255) NOT NULL,
            MoTa TEXT NULL,
            GiangVienHuongDan VARCHAR(100) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`]
    },
    openapi: {
        description: 'Dịch vụ quản lý đề tài tốt nghiệp',
        routes: [
            { method: 'GET', path: '/api/topics', summary: 'Danh sách đề tài (lọc theo ?ids=DT001,DT002)', query: ['ids'] },
            { method: 'GET', path: '/api/topics/:id', summary: 'Chi tiết đề tài' },
            { method: 'POST', path: '/api/topics', summary: 'Thêm đề tài', roles: ['giangvien'], body: ['MaDT', 'TenDT', 'MoTa', 'GiangVienHuongDan'], required: ['MaDT', 'TenDT'] },
            { method: 'PUT', path: '/api/topics/:id', summary: 'Cập nhật đề tài', roles: ['giangvien'], body: ['TenDT', 'MoTa', 'GiangVienHuongDan'], required: ['TenDT'] },
            { method: 'DELETE', path: '/api/topics/:id', summary: 'Xóa đề tài (phát sự kiện topic.deleted)', roles: ['giangvien'] }
        ]
    },
    async init(app, { pool, publish }) {
        const router = express.Router();

        router.get('/', async (req, res) => {
            let rows;
            if (req.query.ids !== undefined) {
                const ids = String(req.query.ids).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 500);
                rows = ids.length ? (await pool.query('SELECT * FROM DETAI WHERE MaDT IN (?)', [ids]))[0] : [];
            } else {
                [rows] = await pool.query('SELECT * FROM DETAI ORDER BY MaDT');
            }
            res.json({ success: true, data: rows });
        });

        router.get('/:id', async (req, res) => {
            const [rows] = await pool.query('SELECT * FROM DETAI WHERE MaDT = ?', [req.params.id]);
            if (!rows[0]) throw new HttpError(404, 'Không tìm thấy đề tài');
            res.json({ success: true, data: rows[0] });
        });

        router.post('/', async (req, res) => {
            const { MaDT, TenDT, MoTa, GiangVienHuongDan } = req.body || {};
            if (!MaDT || !TenDT) throw new HttpError(400, 'Mã đề tài và tên đề tài là bắt buộc');
            try {
                await pool.query('INSERT INTO DETAI (MaDT, TenDT, MoTa, GiangVienHuongDan) VALUES (?, ?, ?, ?)',
                    [MaDT, TenDT, MoTa || null, GiangVienHuongDan || null]);
            } catch (e) {
                if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Mã đề tài đã tồn tại');
                throw e;
            }
            publish('topic.created', { MaDT, TenDT });
            res.status(201).json({ success: true, message: 'Thêm đề tài thành công' });
        });

        router.put('/:id', async (req, res) => {
            const { TenDT, MoTa, GiangVienHuongDan } = req.body || {};
            if (!TenDT) throw new HttpError(400, 'Tên đề tài là bắt buộc');
            const [r] = await pool.query('UPDATE DETAI SET TenDT = ?, MoTa = ?, GiangVienHuongDan = ? WHERE MaDT = ?',
                [TenDT, MoTa || null, GiangVienHuongDan || null, req.params.id]);
            if (r.affectedRows === 0) throw new HttpError(404, 'Không tìm thấy đề tài');
            res.json({ success: true, message: 'Cập nhật đề tài thành công' });
        });

        router.delete('/:id', async (req, res) => {
            const [r] = await pool.query('DELETE FROM DETAI WHERE MaDT = ?', [req.params.id]);
            if (r.affectedRows === 0) throw new HttpError(404, 'Không tìm thấy đề tài');
            publish('topic.deleted', { MaDT: req.params.id });
            res.json({ success: true, message: 'Xóa đề tài thành công' });
        });

        app.use('/api/topics', router);
    }
});
