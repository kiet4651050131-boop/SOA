const topicService = require('../services/topic.service');

// GET /api/topics
async function getAllTopics(req, res) {
    try {
        const topics = await topicService.getAllTopics();

        res.status(200).json({
            success: true,
            data: topics
        });
    } catch (error) {
        console.error('getAllTopics error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách đề tài'
        });
    }
}

// GET /api/topics/:id
async function getTopicById(req, res) {
    try {
        const { id } = req.params;

        const topic = await topicService.getTopicById(id);

        if (!topic) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đề tài'
            });
        }

        res.status(200).json({
            success: true,
            data: topic
        });
    } catch (error) {
        console.error('getTopicById error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thông tin đề tài'
        });
    }
}

// POST /api/topics
async function createTopic(req, res) {
    try {
        const {
            MaDT,
            TenDT,
            MoTa,
            GiangVienHuongDan
        } = req.body;

        if (!MaDT || !TenDT) {
            return res.status(400).json({
                success: false,
                message: 'MaDT và TenDT là bắt buộc'
            });
        }

        await topicService.createTopic({
            MaDT,
            TenDT,
            MoTa,
            GiangVienHuongDan
        });

        res.status(201).json({
            success: true,
            message: 'Thêm đề tài thành công'
        });
    } catch (error) {
        console.error('createTopic error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm đề tài'
        });
    }
}

// PUT /api/topics/:id
async function updateTopic(req, res) {
    try {
        const { id } = req.params;

        const {
            TenDT,
            MoTa,
            GiangVienHuongDan
        } = req.body;

        if (!TenDT) {
            return res.status(400).json({
                success: false,
                message: 'TenDT là bắt buộc'
            });
        }

        const result = await topicService.updateTopic(id, {
            TenDT,
            MoTa,
            GiangVienHuongDan
        });

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đề tài'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật đề tài thành công'
        });
    } catch (error) {
        console.error('updateTopic error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật đề tài'
        });
    }
}

// DELETE /api/topics/:id
async function deleteTopic(req, res) {
    try {
        const { id } = req.params;

        const result = await topicService.deleteTopic(id);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đề tài'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Xóa đề tài thành công'
        });
    } catch (error) {
        console.error('deleteTopic error:', error.message);

        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa đề tài'
        });
    }
}

module.exports = {
    getAllTopics,
    getTopicById,
    createTopic,
    updateTopic,
    deleteTopic
};