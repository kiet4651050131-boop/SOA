const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    console.log('AUTH MIDDLEWARE ĐANG CHẠY');

    // Lấy token từ header Authorization
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: 'Chưa đăng nhập'
        });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
            success: false,
            message: 'Token không hợp lệ'
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'soa_secret_key_2026'
        );

        req.user = decoded;

        next();

    } catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Token hết hạn hoặc không hợp lệ'
        });
    }
}

module.exports = authenticateToken;