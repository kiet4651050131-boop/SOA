const studentService = require('../services/student.service');

// GET /api/students
async function getAllStudents(req, res) {
    try {
        const students = await studentService.getAllStudents();

        res.status(200).json({
            success: true,
            data: students
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách sinh viên'
        });
    }
}

// GET /api/students/:id
async function getStudentById(req, res) {
    try {
        const { id } = req.params;

        const student = await studentService.getStudentById(id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sinh viên'
            });
        }

        res.status(200).json({
            success: true,
            data: student
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thông tin sinh viên'
        });
    }
}

// POST /api/students
async function createStudent(req, res) {
    try {
        const { MaSV, HoTen, Email, Lop } = req.body;

        if (!MaSV || !HoTen) {
            return res.status(400).json({
                success: false,
                message: 'MaSV và HoTen là bắt buộc'
            });
        }

        await studentService.createStudent({
            MaSV,
            HoTen,
            Email,
            Lop
        });

        res.status(201).json({
            success: true,
            message: 'Thêm sinh viên thành công'
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm sinh viên'
        });
    }
}

// PUT /api/students/:id
async function updateStudent(req, res) {
    try {
        const { id } = req.params;
        const { HoTen, Email, Lop } = req.body;

        if (!HoTen) {
            return res.status(400).json({
                success: false,
                message: 'HoTen là bắt buộc'
            });
        }

        const result = await studentService.updateStudent(id, {
            HoTen,
            Email,
            Lop
        });

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sinh viên'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật sinh viên thành công'
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật sinh viên'
        });
    }
}

// DELETE /api/students/:id
async function deleteStudent(req, res) {
    try {
        const { id } = req.params;

        const result = await studentService.deleteStudent(id);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sinh viên'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Xóa sinh viên thành công'
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa sinh viên'
        });
    }
}

module.exports = {
    getAllStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};