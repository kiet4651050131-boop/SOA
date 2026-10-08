const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const authService = require('../services/auth.service');

// POST /api/auth/register
async function register(req, res) {
    try {
        const {
            TenDangNhap,
            MatKhau,
            HoTen,
            Email
        } = req.body;

        if (!TenDangNhap || !MatKhau || !HoTen) {
            return res.status(400).json({
                success: false,
                message: 'Tên đăng nhập, mật khẩu và họ tên là bắt buộc'
            });
        }

        if (MatKhau.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu phải có ít nhất 6 ký tự'
            });
        }

        const existingUser =
            await authService.findByUsername(TenDangNhap);

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Tên đăng nhập đã tồn tại'
            });
        }

        const hashedPassword =
            await bcrypt.hash(MatKhau, 10);

        await authService.createUser({
            TenDangNhap,
            MatKhau: hashedPassword,
            HoTen,
            Email
        });

        res.status(201).json({
            success: true,
            message: 'Đăng ký tài khoản thành công'
        });

    } catch (error) {
        console.error('register error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi đăng ký tài khoản'
        });
    }
}


// POST /api/auth/login
async function login(req, res) {
    try {
        const {
            TenDangNhap,
            MatKhau
        } = req.body;

        // Kiểm tra dữ liệu
        if (!TenDangNhap || !MatKhau) {
            return res.status(400).json({
                success: false,
                message: 'Tên đăng nhập và mật khẩu là bắt buộc'
            });
        }

        // Tìm tài khoản
        const user =
            await authService.findByUsername(TenDangNhap);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Tên đăng nhập hoặc mật khẩu không đúng'
            });
        }

        // Kiểm tra mật khẩu
        const isPasswordCorrect =
            await bcrypt.compare(MatKhau, user.MatKhau);

        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: 'Tên đăng nhập hoặc mật khẩu không đúng'
            });
        }

        // Tạo JWT
        const token = jwt.sign(
            {
                MaTK: user.MaTK,
                TenDangNhap: user.TenDangNhap,
                VaiTro: user.VaiTro
            },
            process.env.JWT_SECRET || 'soa_secret_key_2026',
            {
                expiresIn: '2h'
            }
        );

        res.status(200).json({
            success: true,
            message: 'Đăng nhập thành công',
            token: token,
            user: {
                MaTK: user.MaTK,
                TenDangNhap: user.TenDangNhap,
                HoTen: user.HoTen,
                Email: user.Email,
                VaiTro: user.VaiTro
            }
        });

    } catch (error) {
        console.error('login error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi đăng nhập'
        });
    }
}


module.exports = {
    register,
    login
};