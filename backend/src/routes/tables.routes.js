const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const {
  listTables, createTable, updateTableStatus, deleteTable
} = require('../controllers/tables.controller');

router.use(authenticate);

router.get('/',              listTables);                                      // todos
router.post('/',             authorize('admin'), createTable);                 // admin
router.patch('/:id/status',  authorize('admin'), updateTableStatus);           // admin
router.delete('/:id',        authorize('admin'), deleteTable);                 // admin

module.exports = router;
