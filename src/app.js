const express = require('express');
const cors = require('cors');

const studentRoutes = require('./routes/student.routes');
const topicRoutes = require('./routes/topic.routes');
const registrationRoutes = require('./routes/registration.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Sinh viên
app.use('/api/students', studentRoutes);

// API Đề tài
app.use('/api/topics', topicRoutes);

// API Đăng ký
app.use('/api/registrations', registrationRoutes);

// Route kiểm tra server
app.get('/', (req, res) => {
    res.json({
        message: 'SOA Graduation Project API is running!'
    });
});

module.exports = app;