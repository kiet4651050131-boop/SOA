const express = require('express');

const topicController = require('../controllers/topic.controller');

const router = express.Router();

// GET /api/topics
router.get('/', topicController.getAllTopics);

// GET /api/topics/:id
router.get('/:id', topicController.getTopicById);

// POST /api/topics
router.post('/', topicController.createTopic);

// PUT /api/topics/:id
router.put('/:id', topicController.updateTopic);

// DELETE /api/topics/:id
router.delete('/:id', topicController.deleteTopic);

module.exports = router;