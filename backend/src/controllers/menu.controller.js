const db = require('../config/database');

/**
 * GET /api/menu — Listar itens do cardápio
 * Query param: ?active=true (somente ativos, para venda)
 */
async function listMenuItems(req, res) {
  try {
    const { active } = req.query;
    let sql = `SELECT id, name, category, price, description, is_active, created_at
               FROM menu_items WHERE deleted_at IS NULL`;

    const params = [];
    if (active === 'true') {
      sql += ' AND is_active = true';
    }

    sql += ' ORDER BY category ASC, name ASC';

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
  const { name, category, price, description } = req.body;

  if (!name || !category || price === undefined) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, category, price.' });
  }

  const validCategories = ['prato_principal', 'bebida', 'sobremesa', 'adicional'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: `Categoria inválida. Use: ${validCategories.join(', ')}` });
  }

  if (isNaN(price) || Number(price) < 0) {
    return res.status(400).json({ error: 'Preço deve ser um número positivo.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO menu_items (name, category, price, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, category, price, description, is_active`,
      [name.trim(), category, Number(price), description?.trim() || null]
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
  const { name, category, price, description, is_active } = req.body;

  try {
    const existing = await db.query(
      'SELECT id FROM menu_items WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (name)        { fields.push(`name = $${idx++}`);        values.push(name.trim()); }
    if (category)    { fields.push(`category = $${idx++}`);    values.push(category); }
    if (price !== undefined) { fields.push(`price = $${idx++}`); values.push(Number(price)); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description?.trim() || null); }
    if (is_active !== undefined)   { fields.push(`is_active = $${idx++}`);   values.push(is_active); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE menu_items SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, name, category, price, description, is_active`,
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
      `UPDATE menu_items SET deleted_at = NOW(), is_active = false
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
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
