// REGISTRATION SERVICE – đăng ký đề tài (database riêng: soa_registration)
// Dịch vụ "điều phối": không JOIN sang dữ liệu của dịch vụ khác mà GỌI student-service / topic-service qua HTTP.
const express = require('express');
const { createService, HttpError } = require('../../shared/service-base');

const CANCELLED = 'Da huy';
const REJECTED = 'Tu choi';
// Trạng thái "không còn hiệu lực": SV được đăng ký đề tài khác
const INACTIVE = [CANCELLED, REJECTED];
// Các trạng thái hợp lệ của một đăng ký
const STATUSES = ['Cho duyet', 'Da duyet', 'Tu choi', 'Dang thuc hien', 'Hoan thanh', CANCELLED];

function normalizeStatus(v, fallback) {
    if (v === undefined || v === null || v === '') return fallback;
    if (!STATUSES.includes(v)) throw new HttpError(400, `Trạng thái phải là một trong: ${STATUSES.join(', ')}`);
    return v;
}

const today = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function normalizeScore(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (Number.isNaN(n) || n < 0 || n > 10) throw new HttpError(400, 'Điểm phải nằm trong khoảng từ 0 đến 10');
    return n;
}

createService({
    name: 'registration-service',
    port: 3004,
    db: {
        name: process.env.DB_NAME_REGISTRATION || 'soa_registration',
        schema: [`CREATE TABLE IF NOT EXISTS DANGKY (
            MaDK INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            MaSV VARCHAR(20) NOT NULL,
            MaDT VARCHAR(20) NOT NULL,
            NgayDangKy DATE NULL,
            TrangThai VARCHAR(50) NULL,
            Diem DECIMAL(4,2) NULL,
            KEY idx_sv (MaSV),
            KEY idx_dt (MaDT)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`]
    },
    openapi: {
        description: 'Dịch vụ đăng ký đề tài. Gọi student-service và topic-service để xác minh dữ liệu; phát sự kiện registration.*',
        routes: [
            { method: 'GET', path: '/api/registrations', summary: 'Danh sách đăng ký (kèm họ tên SV, tên đề tài lấy từ dịch vụ khác). Sinh viên chỉ thấy đăng ký của mình' },
            { method: 'GET', path: '/api/registrations/:id', summary: 'Chi tiết đăng ký' },
            { method: 'POST', path: '/api/registrations', summary: 'Đăng ký đề tài (kiểm tra SV/đề tài tồn tại; mỗi SV chỉ 01 đăng ký còn hiệu lực; SV không được tự đặt trạng thái/điểm)', body: ['MaSV', 'MaDT', 'NgayDangKy', 'TrangThai', 'Diem'], required: ['MaDT'], types: { Diem: 'number' }, enums: { TrangThai: STATUSES } },
            { method: 'PUT', path: '/api/registrations/:id', summary: 'Cập nhật đăng ký / trạng thái / điểm', roles: ['giangvien'], body: ['MaSV', 'MaDT', 'NgayDangKy', 'TrangThai', 'Diem'], types: { Diem: 'number' }, enums: { TrangThai: STATUSES } },
            { method: 'DELETE', path: '/api/registrations/:id', summary: 'Xóa đăng ký', roles: ['giangvien'] }
        ]
    },

    // Phản ứng bất đồng bộ với sự kiện từ dịch vụ khác (thay cho khóa ngoại/cascade giữa các database)
    events: {
        'student.deleted': async ({ MaSV }, ev, { pool, log }) => {
            const [r] = await pool.query('UPDATE DANGKY SET TrangThai = ? WHERE MaSV = ? AND (TrangThai IS NULL OR TrangThai <> ?)', [CANCELLED, MaSV, CANCELLED]);
            log(`student.deleted ${MaSV}: hủy ${r.affectedRows} đăng ký`);
        },
        'topic.deleted': async ({ MaDT }, ev, { pool, log }) => {
            const [r] = await pool.query('UPDATE DANGKY SET TrangThai = ? WHERE MaDT = ? AND (TrangThai IS NULL OR TrangThai <> ?)', [CANCELLED, MaDT, CANCELLED]);
            log(`topic.deleted ${MaDT}: hủy ${r.affectedRows} đăng ký`);
        }
    },

    async init(app, { pool, publish, call }) {
        const router = express.Router();

        // ----- Gọi dịch vụ khác -----
        async function fetchMany(service, basePath, ids, key) {
            const map = new Map();
            for (let i = 0; i < ids.length; i += 100) {
                const chunk = ids.slice(i, i + 100);
                const r = await call(service, { path: `${basePath}?ids=${encodeURIComponent(chunk.join(','))}` });
                if (r.status !== 200) throw new Error('HTTP ' + r.status);
                for (const x of r.json().data) map.set(x[key], x);
            }
            return map;
        }

        // Làm giàu dữ liệu; nếu dịch vụ kia sập thì vẫn trả về danh sách (degraded) thay vì lỗi
        async function enrich(rows) {
            const sIds = [...new Set(rows.map((r) => r.MaSV))];
            const tIds = [...new Set(rows.map((r) => r.MaDT))];
            const [s, t] = await Promise.allSettled([
                fetchMany('student-service', '/api/students', sIds, 'MaSV'),
                fetchMany('topic-service', '/api/topics', tIds, 'MaDT')
            ]);
            const degraded = s.status === 'rejected' || t.status === 'rejected';
            const data = rows.map((r) => ({
                ...r,
                HoTen: s.status === 'fulfilled' ? (s.value.get(r.MaSV)?.HoTen ?? '(không còn tồn tại)') : '(không khả dụng)',
                TenDT: t.status === 'fulfilled' ? (t.value.get(r.MaDT)?.TenDT ?? '(không còn tồn tại)') : '(không khả dụng)'
            }));
            return { data, degraded };
        }

        async function ensureExists(service, basePath, id, label) {
            let r;
            try {
                r = await call(service, { path: `${basePath}/${encodeURIComponent(id)}` });
            } catch {
                throw new HttpError(503, `Dịch vụ ${label} tạm thời không khả dụng, chưa thể xác minh "${id}". Vui lòng thử lại sau`);
            }
            if (r.status === 404) throw new HttpError(400, `${label} "${id}" không tồn tại`);
            if (r.status !== 200) throw new HttpError(502, `Dịch vụ ${label} trả về lỗi ${r.status}`);
            return r.json().data;
        }

        // Quy tắc nghiệp vụ: mỗi sinh viên chỉ có 01 đăng ký còn hiệu lực (chưa hủy / chưa bị từ chối)
        async function assertNoActive(MaSV, excludeId = 0) {
            const [dup] = await pool.query(
                'SELECT MaDK, MaDT FROM DANGKY WHERE MaSV = ? AND MaDK <> ? AND (TrangThai IS NULL OR TrangThai NOT IN (?)) LIMIT 1',
                [MaSV, excludeId, INACTIVE]);
            if (dup[0]) throw new HttpError(409, `Sinh viên ${MaSV} đã đăng ký đề tài ${dup[0].MaDT} (mỗi sinh viên chỉ được đăng ký 01 đề tài)`);
        }

        const isStudent = (req) => !!req.user && req.user.VaiTro === 'sinhvien';

        // ----- Endpoints -----
        router.get('/', async (req, res) => {
            const [rows] = isStudent(req)
                ? await pool.query('SELECT * FROM DANGKY WHERE MaSV = ? ORDER BY MaDK', [req.user.TenDangNhap])
                : await pool.query('SELECT * FROM DANGKY ORDER BY MaDK');
            const { data, degraded } = await enrich(rows);
            if (degraded) res.set('X-Degraded', 'true');
            res.json({ success: true, data, degraded });
        });

        router.get('/:id', async (req, res) => {
            const [rows] = await pool.query('SELECT * FROM DANGKY WHERE MaDK = ?', [req.params.id]);
            if (!rows[0] || (isStudent(req) && rows[0].MaSV !== req.user.TenDangNhap)) throw new HttpError(404, 'Không tìm thấy đăng ký');
            const { data, degraded } = await enrich(rows);
            if (degraded) res.set('X-Degraded', 'true');
            res.json({ success: true, data: data[0], degraded });
        });

        router.post('/', async (req, res) => {
            const b = { ...(req.body || {}) };
            if (isStudent(req)) {
                // Sinh viên: chỉ đăng ký cho chính mình, không được tự đặt trạng thái / điểm
                // (quy ước: tên đăng nhập của sinh viên = mã sinh viên)
                if (b.MaSV && b.MaSV !== req.user.TenDangNhap) {
                    throw new HttpError(403, 'Sinh viên chỉ được đăng ký đề tài cho chính mình');
                }
                b.MaSV = req.user.TenDangNhap;
                b.TrangThai = undefined;
                b.Diem = null;
            }
            if (!b.MaSV || !b.MaDT) throw new HttpError(400, 'MaSV và MaDT là bắt buộc');
            const Diem = normalizeScore(b.Diem);
            const status = normalizeStatus(b.TrangThai, 'Cho duyet');

            // Điều phối: xác minh sinh viên và đề tài ở hai dịch vụ khác
            const [student, topic] = await Promise.all([
                ensureExists('student-service', '/api/students', b.MaSV, 'Sinh viên'),
                ensureExists('topic-service', '/api/topics', b.MaDT, 'Đề tài')
            ]);
            if (!INACTIVE.includes(status)) await assertNoActive(b.MaSV);

            const [r] = await pool.query(
                'INSERT INTO DANGKY (MaSV, MaDT, NgayDangKy, TrangThai, Diem) VALUES (?, ?, ?, ?, ?)',
                [b.MaSV, b.MaDT, b.NgayDangKy || today(), status, Diem]);

            publish('registration.created', {
                MaDK: r.insertId, MaSV: b.MaSV, HoTen: student.HoTen, MaDT: b.MaDT, TenDT: topic.TenDT, TrangThai: status
            });
            res.status(201).json({ success: true, message: 'Thêm đăng ký thành công', data: { MaDK: r.insertId } });
        });

        router.put('/:id', async (req, res) => {
            const [rows] = await pool.query('SELECT * FROM DANGKY WHERE MaDK = ?', [req.params.id]);
            const old = rows[0];
            if (!old) throw new HttpError(404, 'Không tìm thấy đăng ký');
            const b = req.body || {};

            const MaSV = b.MaSV || old.MaSV;
            const MaDT = b.MaDT || old.MaDT;
            const Diem = 'Diem' in b ? normalizeScore(b.Diem) : (old.Diem === null ? null : Number(old.Diem));
            const TrangThai = (b.TrangThai !== undefined && b.TrangThai !== '' && b.TrangThai !== old.TrangThai)
                ? normalizeStatus(b.TrangThai) : old.TrangThai;
            const NgayDangKy = b.NgayDangKy || old.NgayDangKy;

            if (MaSV !== old.MaSV) await ensureExists('student-service', '/api/students', MaSV, 'Sinh viên');
            if (MaDT !== old.MaDT) await ensureExists('topic-service', '/api/topics', MaDT, 'Đề tài');
            // Kiểm tra 1 SV - 1 đề tài khi đổi sinh viên hoặc khi "kích hoạt lại" đăng ký đã hủy/từ chối
            const wasInactive = INACTIVE.includes(old.TrangThai);
            if (!INACTIVE.includes(TrangThai) && (MaSV !== old.MaSV || wasInactive)) {
                await assertNoActive(MaSV, old.MaDK);
            }

            await pool.query(
                'UPDATE DANGKY SET MaSV = ?, MaDT = ?, NgayDangKy = ?, TrangThai = ?, Diem = ? WHERE MaDK = ?',
                [MaSV, MaDT, NgayDangKy, TrangThai, Diem, old.MaDK]);

            // Phát sự kiện bất đồng bộ cho dịch vụ thông báo (không chờ kết quả)
            if ((old.TrangThai || null) !== (TrangThai || null)) {
                publish('registration.status_changed', { MaDK: old.MaDK, MaSV, MaDT, from: old.TrangThai, to: TrangThai });
            }
            const oldScore = old.Diem === null ? null : Number(old.Diem);
            if (Diem !== null && Diem !== oldScore) {
                publish('registration.graded', { MaDK: old.MaDK, MaSV, MaDT, Diem });
            }
            res.json({ success: true, message: 'Cập nhật đăng ký thành công' });
        });

        router.delete('/:id', async (req, res) => {
            const [r] = await pool.query('DELETE FROM DANGKY WHERE MaDK = ?', [req.params.id]);
            if (r.affectedRows === 0) throw new HttpError(404, 'Không tìm thấy đăng ký');
            res.json({ success: true, message: 'Xóa đăng ký thành công' });
        });

        app.use('/api/registrations', router);
    }
});
