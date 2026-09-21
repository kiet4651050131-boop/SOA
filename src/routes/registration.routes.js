const express = require('express');

const registrationController = require('../controllers/registration.controller');

const router = express.Router();

// GET /api/registrations
router.get('/', registrationController.getAllRegistrations);

// GET /api/registrations/:id
router.get('/:id', registrationController.getRegistrationById);

// POST /api/registrations
router.post('/', registrationController.createRegistration);

// PUT /api/registrations/:id
router.put('/:id', registrationController.updateRegistration);

// DELETE /api/registrations/:id
router.delete('/:id', registrationController.deleteRegistration);

module.exports = router;