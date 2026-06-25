const express = require('express');
const router = express.Router();
const { login, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/login — Público
router.post('/login', login);

// GET /api/auth/me — Protegido
router.get('/me', authenticate, me);

module.exports = router;
