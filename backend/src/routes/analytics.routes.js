const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// Apenas administradores podem acessar o painel de desempenho
router.use(authenticate);
router.use(authorize('admin'));

router.get('/dashboard', analyticsController.getDashboardData);

module.exports = router;
