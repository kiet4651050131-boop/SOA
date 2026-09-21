const express = require('express');

const studentController = require('../controllers/student.controller');

const router = express.Router();

// GET /api/students
router.get('/', studentController.getAllStudents);

// GET /api/students/:id
router.get('/:id', studentController.getStudentById);

// POST /api/students
router.post('/', studentController.createStudent);

// PUT /api/students/:id
router.put('/:id', studentController.updateStudent);

// DELETE /api/students/:id
router.delete('/:id', studentController.deleteStudent);

module.exports = router;