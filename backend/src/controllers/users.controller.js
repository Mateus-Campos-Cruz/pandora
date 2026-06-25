const bcrypt = require('bcryptjs');
const db = require('../config/database');

/**
 * GET /api/users — Listar usuários (Admin)
 */
async function listUsers(req, res) {
  try {
    const result = await db.query(
      `SELECT id, name, email, role, is_active, created_at
       FROM users
       WHERE deleted_at IS NULL
       ORDER BY name ASC`
    );
    return res.json({ users: result.rows });
  } catch (err) {
    console.error('[users/list]', err);
    return res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
}

/**
 * POST /api/users — Criar usuário (Admin)
 */
async function createUser(req, res) {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, email, password, role.' });
  }

  const validRoles = ['admin', 'atendente', 'cozinha'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Role inválido. Use: ${validRoles.join(', ')}` });
  }

  try {
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase().trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email já cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, is_active, created_at`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, role]
    );

    return res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error('[users/create]', err);
    return res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
}

/**
 * PATCH /api/users/:id — Atualizar usuário (Admin)
 */
async function updateUser(req, res) {
  const { id } = req.params;
  const { name, email, password, role, is_active } = req.body;

  try {
    const existing = await db.query(
      'SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (name)       { fields.push(`name = $${idx++}`);       values.push(name.trim()); }
    if (email)      { fields.push(`email = $${idx++}`);      values.push(email.toLowerCase().trim()); }
    if (role)       { fields.push(`role = $${idx++}`);       values.push(role); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
    if (password)   {
      const hash = await bcrypt.hash(password, 12);
      fields.push(`password_hash = $${idx++}`);
      values.push(hash);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, is_active`,
      values
    );

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('[users/update]', err);
    return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
}

/**
 * DELETE /api/users/:id — Soft delete (Admin)
 */
async function deleteUser(req, res) {
  const { id } = req.params;

  // Não permite auto-exclusão
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Você não pode excluir sua própria conta.' });
  }

  try {
    const result = await db.query(
      `UPDATE users SET deleted_at = NOW(), is_active = false
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    return res.json({ message: 'Usuário desativado com sucesso.' });
  } catch (err) {
    console.error('[users/delete]', err);
    return res.status(500).json({ error: 'Erro ao desativar usuário.' });
  }
}

module.exports = { listUsers, createUser, updateUser, deleteUser };
