const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { getHistory } = require('../controllers/history.controller');

router.use(authenticate, authorize('admin', 'atendente'));

router.get('/', getHistory);

module.exports = router;
