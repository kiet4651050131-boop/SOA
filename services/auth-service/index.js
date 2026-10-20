// AUTH SERVICE – tài khoản, đăng nhập, cấp JWT, vai trò (database riêng: soa_auth)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('../../shared/jwt');
const { jwtSecret } = require('../../shared/env');
const { createService, HttpError, requireRole } = require('../../shared/service-base');

createService({
    name: 'auth-service',
    port: 3001,
    db: {
        name: process.env.DB_NAME_AUTH || 'soa_auth',
        schema: [`CREATE TABLE IF NOT EXISTS TAIKHOAN (
            MaTK INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            TenDangNhap VARCHAR(50) NOT NULL UNIQUE,
            MatKhau VARCHAR(255) NOT NULL,
            HoTen VARCHAR(100) NOT NULL,
            Email VARCHAR(100) NULL,
            VaiTro VARCHAR(20) NOT NULL DEFAULT 'giangvien',
            NgayTao TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`]
    },
    openapi: {
        description: 'Dịch vụ xác thực & phân quyền. Hệ thống chỉ có một vai trò: giangvien (sinh viên không đăng nhập, dữ liệu do giảng viên nhập).',
        routes: [
            { method: 'POST', path: '/api/auth/register', summary: 'Tạo thêm tài khoản giảng viên (cần đăng nhập bằng tài khoản giảng viên)', body: ['TenDangNhap', 'MatKhau', 'HoTen', 'Email'], required: ['TenDangNhap', 'MatKhau', 'HoTen'] },
            { method: 'POST', path: '/api/auth/login', summary: 'Đăng nhập, nhận JWT', auth: false, body: ['TenDangNhap', 'MatKhau'], required: ['TenDangNhap', 'MatKhau'] },
            { method: 'GET', path: '/api/auth/me', summary: 'Thông tin người dùng hiện tại' },
            { method: 'POST', path: '/api/auth/verify', summary: 'Kiểm tra token (dịch vụ khác có thể tái sử dụng)', body: ['token'], required: ['token'] },
            { method: 'GET', path: '/api/auth/users', summary: 'Danh sách tài khoản', roles: ['giangvien'] }
        ]
    },
    async init(app, { pool, log, publish }) {
        const router = express.Router();

        // Hệ thống chỉ có giảng viên: tài khoản admin cũ (nếu có) được chuyển thành giảng viên
        await pool.query("UPDATE TAIKHOAN SET VaiTro = 'giangvien' WHERE VaiTro = 'admin'");

        // Bảo đảm luôn có ít nhất một tài khoản giảng viên (lấy từ .env: ADMIN_USERNAME / ADMIN_PASSWORD)
        const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM TAIKHOAN WHERE VaiTro = 'giangvien'");
        if (n === 0) {
            const username = process.env.ADMIN_USERNAME || 'admin';
            const password = process.env.ADMIN_PASSWORD || 'admin123';
            const [exist] = await pool.query('SELECT MaTK FROM TAIKHOAN WHERE TenDangNhap = ?', [username]);
            if (exist[0]) {
                await pool.query("UPDATE TAIKHOAN SET VaiTro = 'giangvien' WHERE MaTK = ?", [exist[0].MaTK]);
            } else {
                await pool.query('INSERT INTO TAIKHOAN (TenDangNhap, MatKhau, HoTen, VaiTro) VALUES (?, ?, ?, ?)',
                    [username, await bcrypt.hash(password, 10), 'Giảng viên', 'giangvien']);
            }
            log(`Đã tạo/chỉ định tài khoản giảng viên "${username}"` +
                (process.env.ADMIN_PASSWORD ? '' : ' với mật khẩu mặc định "admin123" – hãy đổi ngay (ADMIN_PASSWORD trong .env)'));
        }

        router.post('/register', async (req, res) => {
            const { TenDangNhap, MatKhau, HoTen, Email } = req.body || {};
            if (!TenDangNhap || !MatKhau || !HoTen) throw new HttpError(400, 'Tên đăng nhập, mật khẩu và họ tên là bắt buộc');
            if (String(MatKhau).length < 6) throw new HttpError(400, 'Mật khẩu phải có ít nhất 6 ký tự');
            const hash = await bcrypt.hash(String(MatKhau), 10);
            try {
                // Chỉ giảng viên đã đăng nhập mới gọi được (gateway chặn); tài khoản mới luôn là giảng viên
                await pool.query('INSERT INTO TAIKHOAN (TenDangNhap, MatKhau, HoTen, Email, VaiTro) VALUES (?, ?, ?, ?, ?)',
                    [TenDangNhap, hash, HoTen, Email || null, 'giangvien']);
            } catch (e) {
                if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Tên đăng nhập đã tồn tại');
                throw e;
            }
            publish('user.registered', { TenDangNhap, HoTen });
            res.status(201).json({ success: true, message: 'Đăng ký tài khoản thành công' });
        });

        router.post('/login', async (req, res) => {
            const { TenDangNhap, MatKhau } = req.body || {};
            if (!TenDangNhap || !MatKhau) throw new HttpError(400, 'Tên đăng nhập và mật khẩu là bắt buộc');
            const [rows] = await pool.query('SELECT * FROM TAIKHOAN WHERE TenDangNhap = ?', [TenDangNhap]);
            const user = rows[0];
            if (!user || !(await bcrypt.compare(String(MatKhau), user.MatKhau))) {
                throw new HttpError(401, 'Tên đăng nhập hoặc mật khẩu không đúng');
            }
            const token = jwt.sign({ MaTK: user.MaTK, TenDangNhap: user.TenDangNhap, VaiTro: user.VaiTro }, jwtSecret(), 7200);
            res.json({
                success: true, message: 'Đăng nhập thành công', token,
                user: { MaTK: user.MaTK, TenDangNhap: user.TenDangNhap, HoTen: user.HoTen, Email: user.Email, VaiTro: user.VaiTro }
            });
        });

        router.get('/me', (req, res) => {
            if (!req.user) throw new HttpError(401, 'Chưa đăng nhập');
            res.json({ success: true, data: req.user });
        });

        router.post('/verify', (req, res) => {
            try {
                const p = jwt.verify((req.body || {}).token, jwtSecret());
                res.json({ success: true, valid: true, user: { MaTK: p.MaTK, TenDangNhap: p.TenDangNhap, VaiTro: p.VaiTro } });
            } catch {
                res.json({ success: true, valid: false });
            }
        });

        router.get('/users', async (req, res) => {
            requireRole(req, 'giangvien');
            const [rows] = await pool.query('SELECT MaTK, TenDangNhap, HoTen, Email, VaiTro, NgayTao FROM TAIKHOAN ORDER BY MaTK');
            res.json({ success: true, data: rows });
        });

        app.use('/api/auth', router);
    }
});
