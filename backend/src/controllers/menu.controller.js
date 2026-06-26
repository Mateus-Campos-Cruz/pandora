const db = require('../config/database');

/**
 * GET /api/menu — Listar itens do cardápio
 * Query param: ?active=true (somente ativos, para venda)
 */
async function listMenuItems(req, res) {
  try {
    const { active } = req.query;
    let sql = `SELECT id, nome AS name, categoria AS category, 0 AS price, '' AS description, ativo AS is_active, criado_em AS created_at
               FROM cardapio_itens WHERE 1=1`;

    const params = [];
    if (active === 'true') {
      sql += ' AND ativo = true';
    }

    sql += ' ORDER BY categoria ASC, nome ASC';

    const result = await db.query(sql, params);
    return res.json({ items: result.rows });
  } catch (err) {
    console.error('[menu/list]', err);
    return res.status(500).json({ error: 'Erro ao listar cardápio.' });
  }
}

/**
 * POST /api/menu — Criar item do cardápio (Admin)
 */
async function createMenuItem(req, res) {
  const { name, category } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, category.' });
  }

  const validCategories = ['prato_principal', 'bebida', 'sobremesa', 'adicional'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: `Categoria inválida. Use: ${validCategories.join(', ')}` });
  }

  try {
    const result = await db.query(
      `INSERT INTO cardapio_itens (nome, categoria)
       VALUES ($1, $2)
       RETURNING id, nome AS name, categoria AS category, 0 AS price, '' AS description, ativo AS is_active`,
      [name.trim(), category]
    );

    return res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    console.error('[menu/create]', err);
    return res.status(500).json({ error: 'Erro ao criar item do cardápio.' });
  }
}

/**
 * PATCH /api/menu/:id — Editar item (Admin)
 */
async function updateMenuItem(req, res) {
  const { id } = req.params;
  const { name, category, is_active } = req.body;

  try {
    const existing = await db.query(
      'SELECT id FROM cardapio_itens WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (name)        { fields.push(`nome = $${idx++}`);        values.push(name.trim()); }
    if (category)    { fields.push(`categoria = $${idx++}`);    values.push(category); }
    if (is_active !== undefined)   { fields.push(`ativo = $${idx++}`);   values.push(is_active); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE cardapio_itens SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, nome AS name, categoria AS category, 0 AS price, '' AS description, ativo AS is_active`,
      values
    );

    return res.json({ item: result.rows[0] });
  } catch (err) {
    console.error('[menu/update]', err);
    return res.status(500).json({ error: 'Erro ao atualizar item.' });
  }
}

/**
 * DELETE /api/menu/:id — Soft delete (Admin)
 */
async function deleteMenuItem(req, res) {
  const { id } = req.params;

  try {
    const result = await db.query(
      `UPDATE cardapio_itens SET ativo = FALSE
       WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    return res.json({ message: 'Item removido do cardápio.' });
  } catch (err) {
    console.error('[menu/delete]', err);
    return res.status(500).json({ error: 'Erro ao remover item.' });
  }
}

module.exports = { listMenuItems, createMenuItem, updateMenuItem, deleteMenuItem };
