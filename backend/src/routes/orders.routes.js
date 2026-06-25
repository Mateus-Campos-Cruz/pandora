const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const {
  listActiveOrders,
  getOrder,
  createOrder,
  addItem,
  updateItem,
  updateOrderStatus,
} = require('../controllers/orders.controller');

router.use(authenticate);

// Cozinha pode atualizar status, mas não criar pedidos
router.get('/',                        authorize('admin', 'atendente'),          listActiveOrders);
router.get('/:id',                     authorize('admin', 'atendente', 'cozinha'), getOrder);
router.post('/',                       authorize('admin', 'atendente'),          createOrder);
router.post('/:id/items',              authorize('admin', 'atendente'),          addItem);
router.patch('/:id/items/:itemId',     authorize('admin', 'atendente'),          updateItem);
router.patch('/:id/status',            authorize('admin', 'atendente', 'cozinha'), updateOrderStatus);

module.exports = router;
