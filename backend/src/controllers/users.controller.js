const bcrypt = require('bcryptjs');
const db = require('../config/database');

/**
 * GET /api/users — Listar usuários (Admin)
 */
async function listUsers(req, res) {
  try {
    const result = await db.query(
      `SELECT id, nome AS name, email, perfil AS role, ativo AS is_active, criado_em AS created_at
       FROM usuarios
       WHERE ativo = TRUE
       ORDER BY nome ASC`
    );
    
    // Mapeia administrador -> admin para o frontend
    const users = result.rows.map(u => ({
      ...u,
      role: u.role === 'administrador' ? 'admin' : u.role
    }));

    return res.json({ users });
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

  // Mapeia para o banco (administrador)
  const dbPerfil = role === 'admin' ? 'administrador' : role;

  try {
    const existing = await db.query(
      'SELECT id FROM usuarios WHERE email = $1 AND ativo = TRUE',
      [email.toLowerCase().trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email já cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome AS name, email, perfil AS role, ativo AS is_active, criado_em AS created_at`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, dbPerfil]
    );

    const user = result.rows[0];
    user.role = user.role === 'administrador' ? 'admin' : user.role;

    return res.status(201).json({ user });
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
      'SELECT id FROM usuarios WHERE id = $1 AND ativo = TRUE',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (name) { 
      fields.push(`nome = $${idx++}`); 
      values.push(name.trim()); 
    }
    if (email) { 
      fields.push(`email = $${idx++}`); 
      values.push(email.toLowerCase().trim()); 
    }
    if (role) { 
      fields.push(`perfil = $${idx++}`); 
      values.push(role === 'admin' ? 'administrador' : role); 
    }
    if (is_active !== undefined) { 
      fields.push(`ativo = $${idx++}`); 
      values.push(is_active); 
    }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      fields.push(`senha_hash = $${idx++}`);
      values.push(hash);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE usuarios SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, nome AS name, email, perfil AS role, ativo AS is_active`,
      values
    );

    const user = result.rows[0];
    user.role = user.role === 'administrador' ? 'admin' : user.role;

    return res.json({ user });
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
      `UPDATE usuarios SET ativo = FALSE
       WHERE id = $1 AND ativo = TRUE
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
