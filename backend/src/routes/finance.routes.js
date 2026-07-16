const express = require('express');
const router = express.Router();
const financeController = require('../controllers/finance.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// Rotas restritas apenas para administradores (RNF-M2-02)
router.use(authenticate, authorize('admin'));

router.get('/closing', financeController.getClosingData);
router.post('/closing', financeController.closeRegister);

module.exports = router;
