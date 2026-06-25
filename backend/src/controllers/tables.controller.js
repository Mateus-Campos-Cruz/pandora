const db = require('../config/database');

/**
 * GET /api/tables — Listar todas as mesas
 */
async function listTables(req, res) {
  try {
    const result = await db.query(
      `SELECT t.id, t.identifier, t.status, t.capacity, t.created_at,
              o.id as active_order_id
       FROM tables t
       LEFT JOIN orders o ON o.table_id = t.id
         AND o.deleted_at IS NULL
         AND o.status NOT IN ('entregue', 'encerrado')
       WHERE t.deleted_at IS NULL
       ORDER BY t.identifier ASC`
    );
    return res.json({ tables: result.rows });
  } catch (err) {
    console.error('[tables/list]', err);
    return res.status(500).json({ error: 'Erro ao listar mesas.' });
  }
}

/**
 * POST /api/tables — Criar mesa (Admin)
 */
async function createTable(req, res) {
  const { identifier, capacity } = req.body;

  if (!identifier) {
    return res.status(400).json({ error: 'Identificador da mesa é obrigatório.' });
  }

  try {
    const existing = await db.query(
      'SELECT id FROM tables WHERE identifier = $1 AND deleted_at IS NULL',
      [identifier.trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: `Mesa '${identifier}' já existe.` });
    }

    const result = await db.query(
      `INSERT INTO tables (identifier, capacity) VALUES ($1, $2)
       RETURNING id, identifier, status, capacity`,
      [identifier.trim(), capacity || 4]
    );

    return res.status(201).json({ table: result.rows[0] });
  } catch (err) {
    console.error('[tables/create]', err);
    return res.status(500).json({ error: 'Erro ao criar mesa.' });
  }
}

/**
 * PATCH /api/tables/:id/status — Alterar status manualmente (Admin)
 */
async function updateTableStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['livre', 'ocupada'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status inválido. Use: ${validStatuses.join(', ')}` });
  }

  try {
    const result = await db.query(
      `UPDATE tables SET status = $1 WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, identifier, status`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mesa não encontrada.' });
    }

    return res.json({ table: result.rows[0] });
  } catch (err) {
    console.error('[tables/updateStatus]', err);
    return res.status(500).json({ error: 'Erro ao atualizar status da mesa.' });
  }
}

/**
 * DELETE /api/tables/:id — Soft delete (Admin)
 */
async function deleteTable(req, res) {
  const { id } = req.params;

  try {
    // Verificar se há pedido ativo
    const activeOrder = await db.query(
      `SELECT id FROM orders WHERE table_id = $1 AND deleted_at IS NULL
       AND status NOT IN ('entregue', 'encerrado')`,
      [id]
    );

    if (activeOrder.rows.length > 0) {
      return res.status(409).json({ error: 'Não é possível excluir mesa com pedido ativo.' });
    }

    const result = await db.query(
      `UPDATE tables SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mesa não encontrada.' });
    }

    return res.json({ message: 'Mesa removida com sucesso.' });
  } catch (err) {
    console.error('[tables/delete]', err);
    return res.status(500).json({ error: 'Erro ao remover mesa.' });
  }
}

module.exports = { listTables, createTable, updateTableStatus, deleteTable };
