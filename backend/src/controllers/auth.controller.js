const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const result = await db.query(
      `SELECT id, name, email, password_hash, role, is_active
       FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Usuário inativo. Contate o administrador.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const payload = {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    return res.json({
      token,
      user: payload,
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

/**
 * POST /api/auth/me — Retorna dados do usuário autenticado
 */
async function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = { login, me };
