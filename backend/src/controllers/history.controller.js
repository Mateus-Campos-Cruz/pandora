const db = require('../config/database');

/**
 * GET /api/history — Histórico de pedidos encerrados
 * Query params: date, type (salao/delivery), status, page, limit
 */
async function getHistory(req, res) {
  const { date, type, status, page = 1, limit = 20 } = req.query;

  const conditions = ["o.status = 'encerrado'"];
  const params = [];
  let idx = 1;

  if (date) {
    conditions.push(`DATE(o.aberto_em AT TIME ZONE 'America/Sao_Paulo') = $${idx++}`);
    params.push(date);
  }

  if (type && ['salao', 'delivery'].includes(type)) {
    conditions.push(`o.tipo = $${idx++}`);
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
      `SELECT COUNT(*) FROM pedidos o WHERE ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].count, 10);

    params.push(Number(limit));
    params.push(offset);

    const result = await db.query(
      `SELECT
         o.id, o.tipo AS type, o.status,
         c.nome as customer_name, c.telefone as customer_phone,
         o.aberto_em AS opened_at, o.encerrado_em AS closed_at,
         t.numero as table_identifier,
         u.nome as attendant_name,
         COUNT(oi.id) FILTER (WHERE oi.cancelado = false) as item_count,
         0 as total
       FROM pedidos o
       LEFT JOIN mesas t ON t.id = o.mesa_id
       LEFT JOIN clientes c ON c.id = o.cliente_id
       LEFT JOIN usuarios u ON u.id = o.atendente_id
       LEFT JOIN pedido_itens oi ON oi.pedido_id = o.id
       WHERE ${whereClause}
       GROUP BY o.id, t.numero, c.nome, c.telefone, u.nome
       ORDER BY o.encerrado_em DESC
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
