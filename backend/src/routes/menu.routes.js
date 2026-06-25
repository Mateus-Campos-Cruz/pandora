const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const {
  listMenuItems, createMenuItem, updateMenuItem, deleteMenuItem
} = require('../controllers/menu.controller');

router.use(authenticate);

router.get('/',        listMenuItems);                              // todos (query ?active=true para venda)
router.post('/',       authorize('admin'), createMenuItem);         // admin
router.patch('/:id',   authorize('admin'), updateMenuItem);         // admin
router.delete('/:id',  authorize('admin'), deleteMenuItem);         // admin

module.exports = router;
