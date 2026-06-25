const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { listUsers, createUser, updateUser, deleteUser } = require('../controllers/users.controller');

// Todas as rotas de usuários são restritas ao Admin
router.use(authenticate, authorize('admin'));

router.get('/',        listUsers);
router.post('/',       createUser);
router.patch('/:id',   updateUser);
router.delete('/:id',  deleteUser);

module.exports = router;
