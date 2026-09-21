const registrationService = require('../services/registration.service');

// GET /api/registrations
async function getAllRegistrations(req, res) {
    try {
        const registrations =
            await registrationService.getAllRegistrations();

        res.status(200).json({
            success: true,
            data: registrations
        });
    } catch (error) {
        console.error('getAllRegistrations error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách đăng ký'
        });
    }
}

// GET /api/registrations/:id
async function getRegistrationById(req, res) {
    try {
        const { id } = req.params;

        const registration =
            await registrationService.getRegistrationById(id);

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đăng ký'
            });
        }

        res.status(200).json({
            success: true,
            data: registration
        });
    } catch (error) {
        console.error('getRegistrationById error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thông tin đăng ký'
        });
    }
}

// POST /api/registrations
async function createRegistration(req, res) {
    try {
        const {
            MaSV,
            MaDT,
            NgayDangKy,
            TrangThai
        } = req.body;

        if (!MaSV || !MaDT) {
            return res.status(400).json({
                success: false,
                message: 'MaSV và MaDT là bắt buộc'
            });
        }

        await registrationService.createRegistration({
            MaSV,
            MaDT,
            NgayDangKy,
            TrangThai
        });

        res.status(201).json({
            success: true,
            message: 'Thêm đăng ký thành công'
        });
    } catch (error) {
        console.error('createRegistration error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm đăng ký'
        });
    }
}

// PUT /api/registrations/:id
async function updateRegistration(req, res) {
    try {
        const { id } = req.params;

        const {
            MaSV,
            MaDT,
            NgayDangKy,
            TrangThai
        } = req.body;

        if (!MaSV || !MaDT) {
            return res.status(400).json({
                success: false,
                message: 'MaSV và MaDT là bắt buộc'
            });
        }

        const result =
            await registrationService.updateRegistration(id, {
                MaSV,
                MaDT,
                NgayDangKy,
                TrangThai
            });

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đăng ký'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật đăng ký thành công'
        });
    } catch (error) {
        console.error('updateRegistration error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật đăng ký'
        });
    }
}

// DELETE /api/registrations/:id
async function deleteRegistration(req, res) {
    try {
        const { id } = req.params;

        const result =
            await registrationService.deleteRegistration(id);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đăng ký'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Xóa đăng ký thành công'
        });
    } catch (error) {
        console.error('deleteRegistration error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa đăng ký'
        });
    }
}

module.exports = {
    getAllRegistrations,
    getRegistrationById,
    createRegistration,
    updateRegistration,
    deleteRegistration
};