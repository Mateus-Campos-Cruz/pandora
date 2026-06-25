const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { getKitchenQueue } = require('../controllers/kitchen.controller');

router.use(authenticate, authorize('admin', 'cozinha'));

router.get('/queue', getKitchenQueue);

module.exports = router;
