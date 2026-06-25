const db = require('../config/database');

/**
 * GET /api/kitchen/queue — Fila da cozinha (pedidos ativos)
 */
async function getKitchenQueue(req, res) {
  try {
    const result = await db.query(
      `SELECT
         o.id, o.type, o.status, o.opened_at,
         t.identifier as table_identifier,
         o.customer_name,
         json_agg(
           json_build_object(
             'id', oi.id,
             'item_name', mi.name,
             'category', mi.category,
             'quantity', oi.quantity,
             'observation', oi.observation,
             'is_cancelled', oi.is_cancelled
           ) ORDER BY oi.created_at ASC
         ) FILTER (WHERE oi.id IS NOT NULL) as items
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE o.deleted_at IS NULL
         AND o.status IN ('recebido', 'em_preparo', 'pronto')
       GROUP BY o.id, t.identifier
       ORDER BY o.opened_at ASC`
    );

    return res.json({ queue: result.rows });
  } catch (err) {
    console.error('[kitchen/queue]', err);
    return res.status(500).json({ error: 'Erro ao buscar fila da cozinha.' });
  }
}

module.exports = { getKitchenQueue };
