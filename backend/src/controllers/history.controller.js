const db = require('../config/database');

/**
 * GET /api/history — Histórico de pedidos encerrados
 * Query params: date, type (salao/delivery), status, page, limit
 */
async function getHistory(req, res) {
  const { date, type, status, page = 1, limit = 20 } = req.query;

  const conditions = ["o.deleted_at IS NULL", "o.status = 'encerrado'"];
  const params = [];
  let idx = 1;

  if (date) {
    conditions.push(`DATE(o.opened_at AT TIME ZONE 'America/Sao_Paulo') = $${idx++}`);
    params.push(date);
  }

  if (type && ['salao', 'delivery'].includes(type)) {
    conditions.push(`o.type = $${idx++}`);
    params.push(type);
  }

  // Se status diferente de encerrado for passado, ajustar
  if (status && status !== 'encerrado') {
    conditions[conditions.indexOf("o.status = 'encerrado'")] = `o.status = $${idx++}`;
    params.push(status);
  }

  const offset = (Number(page) - 1) * Number(limit);

  try {
    const whereClause = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*) FROM orders o WHERE ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].count, 10);

    params.push(Number(limit));
    params.push(offset);

    const result = await db.query(
      `SELECT
         o.id, o.type, o.status,
         o.customer_name, o.customer_phone,
         o.opened_at, o.closed_at,
         t.identifier as table_identifier,
         u.name as attendant_name,
         COUNT(oi.id) FILTER (WHERE oi.is_cancelled = false) as item_count,
         COALESCE(SUM(oi.unit_price * oi.quantity) FILTER (WHERE oi.is_cancelled = false), 0) as total
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN users u ON u.id = o.attendant_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE ${whereClause}
       GROUP BY o.id, t.identifier, u.name
       ORDER BY o.closed_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    return res.json({
      orders: result.rows,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error('[history/get]', err);
    return res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
}

module.exports = { getHistory };
