// NOTIFICATION SERVICE – nhận sự kiện bất đồng bộ từ Event Bus và lưu thông báo (database riêng: soa_notification)
// Audience: "staff" (giảng viên) | "all" | "user:<TenDangNhap>" (sinh viên dùng MaSV làm tên đăng nhập sẽ nhận thông báo cá nhân)
const express = require('express');
const { createService, HttpError } = require('../../shared/service-base');

const builders = {
    'registration.created': (p) => [
        ['staff', 'Đăng ký đề tài mới', `${p.HoTen || p.MaSV} (${p.MaSV}) đăng ký đề tài "${p.TenDT || p.MaDT}"`],
        [`user:${p.MaSV}`, 'Đã ghi nhận đăng ký', `Đăng ký đề tài "${p.TenDT || p.MaDT}" của bạn đang ở trạng thái "${p.TrangThai || ''}"`]
    ],
    'registration.status_changed': (p) => [
        ['staff', 'Trạng thái đăng ký thay đổi', `Đăng ký #${p.MaDK} (${p.MaSV} – ${p.MaDT}): "${p.from || ''}" → "${p.to || ''}"`],
        [`user:${p.MaSV}`, 'Trạng thái đăng ký của bạn đã đổi', `Đề tài ${p.MaDT}: "${p.from || ''}" → "${p.to || ''}"`]
    ],
    'registration.graded': (p) => [
        ['staff', 'Đã chấm điểm', `Đăng ký #${p.MaDK} (${p.MaSV} – ${p.MaDT}) được ${p.Diem} điểm`],
        [`user:${p.MaSV}`, 'Bạn đã có điểm', `Đề tài ${p.MaDT}: ${p.Diem} điểm`]
    ],
    'user.registered': (p) => [
        ['staff', 'Tài khoản mới', `${p.HoTen} (${p.TenDangNhap}) vừa đăng ký tài khoản`],
        [`user:${p.TenDangNhap}`, 'Chào mừng', `Xin chào ${p.HoTen}, tài khoản của bạn đã được tạo`]
    ],
    'student.created': (p) => [['staff', 'Sinh viên mới', `Đã thêm sinh viên ${p.HoTen || ''} (${p.MaSV})`]],
    'topic.created': (p) => [['staff', 'Đề tài mới', `Đã thêm đề tài ${p.MaDT}: ${p.TenDT || ''}`]],
    'student.deleted': (p) => [['staff', 'Sinh viên bị xóa', `Sinh viên ${p.MaSV} đã bị xóa; các đăng ký liên quan được hủy`]],
    'topic.deleted': (p) => [['staff', 'Đề tài bị xóa', `Đề tài ${p.MaDT} đã bị xóa; các đăng ký liên quan được hủy`]]
};

async function store(pool, ev) {
    const build = builders[ev.topic];
    if (!build) return;
    for (const [audience, title, message] of build(ev.payload || {})) {
        // UNIQUE(event_id, audience) + INSERT IGNORE => nhận lại cùng sự kiện không tạo thông báo trùng (idempotent)
        await pool.query(
            'INSERT IGNORE INTO notifications (event_id, topic, audience, title, message) VALUES (?, ?, ?, ?, ?)',
            [ev.id, ev.topic, audience, title, message]);
    }
}

createService({
    name: 'notification-service',
    port: 3005,
    db: {
        name: process.env.DB_NAME_NOTIFICATION || 'soa_notification',
        schema: [`CREATE TABLE IF NOT EXISTS notifications (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            event_id VARCHAR(64) NOT NULL,
            topic VARCHAR(100) NOT NULL,
            audience VARCHAR(100) NOT NULL,
            title VARCHAR(200) NOT NULL,
            message VARCHAR(500) NOT NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_event_audience (event_id, audience),
            KEY idx_audience (audience)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`]
    },
    openapi: {
        description: 'Dịch vụ thông báo – hoạt động hoàn toàn dựa trên sự kiện bất đồng bộ từ Event Bus',
        routes: [
            { method: 'GET', path: '/api/notifications', summary: 'Thông báo của người dùng hiện tại (kèm số chưa đọc)' },
            { method: 'PUT', path: '/api/notifications/:id/read', summary: 'Đánh dấu đã đọc' }
        ]
    },
    events: Object.fromEntries(Object.keys(builders).map((t) => [t, async (payload, ev, { pool }) => store(pool, ev)])),

    async init(app, { pool }) {
        const router = express.Router();

        function audiencesOf(user) {
            if (!user) throw new HttpError(401, 'Chưa đăng nhập');
            const a = ['all', `user:${user.TenDangNhap}`];
            if (user.VaiTro === 'giangvien') a.push('staff');
            return a;
        }

        router.get('/', async (req, res) => {
            const aud = audiencesOf(req.user);
            const [rows] = await pool.query(
                'SELECT id, topic, title, message, is_read, created_at FROM notifications WHERE audience IN (?) ORDER BY id DESC LIMIT 50', [aud]);
            const [[{ unread }]] = await pool.query(
                'SELECT COUNT(*) AS unread FROM notifications WHERE audience IN (?) AND is_read = 0', [aud]);
            res.json({ success: true, data: rows, unread });
        });

        router.put('/:id/read', async (req, res) => {
            const [r] = await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND audience IN (?)',
                [req.params.id, audiencesOf(req.user)]);
            if (r.affectedRows === 0) throw new HttpError(404, 'Không tìm thấy thông báo');
            res.json({ success: true });
        });

        app.use('/api/notifications', router);
    }
});
