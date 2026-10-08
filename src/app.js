const express = require('express');
const cors = require('cors');
const path = require('path');

const studentRoutes = require('./routes/student.routes');
const topicRoutes = require('./routes/topic.routes');
const registrationRoutes = require('./routes/registration.routes');
const authRoutes = require('./routes/auth.routes');
const authenticateToken = require('./middlewares/auth.middleware');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Frontend
app.use(express.static(path.join(__dirname, '../public')));

// API Tài khoản
// Không cần đăng nhập để đăng ký và đăng nhập
app.use('/api/auth', authRoutes);

// API Sinh viên
// Yêu cầu đăng nhập
app.use('/api/students', authenticateToken, studentRoutes);

// API Đề tài
// Yêu cầu đăng nhập
app.use('/api/topics', authenticateToken, topicRoutes);

// API Đăng ký
// Yêu cầu đăng nhập
app.use('/api/registrations', authenticateToken, registrationRoutes);

// Route kiểm tra server
app.get('/', (req, res) => {
    res.json({
        message: 'SOA Graduation Project API is running!'
    });
});

module.exports = app;