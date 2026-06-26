const db = require('../config/database');

/**
 * GET /api/tables — Listar todas as mesas
 */
async function listTables(req, res) {
  try {
    const result = await db.query(
      `SELECT t.id, t.numero AS identifier, t.status, 4 AS capacity, t.criado_em AS created_at,
              o.id AS active_order_id
       FROM mesas t
       LEFT JOIN pedidos o ON o.mesa_id = t.id
         AND o.status NOT IN ('entregue', 'encerrado')
       ORDER BY t.numero ASC`
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
  const { identifier } = req.body;

  if (!identifier) {
    return res.status(400).json({ error: 'Identificador da mesa é obrigatório.' });
  }

  try {
    const existing = await db.query(
      'SELECT id FROM mesas WHERE numero = $1',
      [identifier.trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: `Mesa '${identifier}' já existe.` });
    }

    const result = await db.query(
      `INSERT INTO mesas (numero) VALUES ($1)
       RETURNING id, numero AS identifier, status, 4 AS capacity`,
      [identifier.trim()]
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
      `UPDATE mesas SET status = $1 WHERE id = $2
       RETURNING id, numero AS identifier, status`,
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
 * DELETE /api/tables/:id — Remover mesa (Admin)
 */
async function deleteTable(req, res) {
  const { id } = req.params;

  try {
    // Verificar se há pedido ativo
    const activeOrder = await db.query(
      `SELECT id FROM pedidos WHERE mesa_id = $1
       AND status NOT IN ('entregue', 'encerrado')`,
      [id]
    );

    if (activeOrder.rows.length > 0) {
      return res.status(409).json({ error: 'Não é possível excluir mesa com pedido ativo.' });
    }

    const result = await db.query(
      `DELETE FROM mesas WHERE id = $1 RETURNING id`,
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
