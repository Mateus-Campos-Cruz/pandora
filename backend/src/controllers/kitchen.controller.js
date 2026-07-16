const db = require('../config/database');

/**
 * GET /api/kitchen/queue — Fila da cozinha (pedidos ativos)
 */
async function getKitchenQueue(req, res) {
  try {
    const result = await db.query(
      `SELECT
         o.id, o.tipo AS type, o.status, o.aberto_em AS opened_at,
         t.numero as table_identifier,
         c.nome as customer_name,
         json_agg(
           json_build_object(
             'id', oi.id,
             'item_name', mi.nome,
             'category', mi.categoria,
             'quantity', oi.quantidade,
             'observation', oi.observacao,
             'is_cancelled', oi.cancelado
           ) ORDER BY oi.adicionado_em ASC
         ) FILTER (WHERE oi.id IS NOT NULL AND mi.categoria != 'bebida') as items
       FROM pedidos o
       LEFT JOIN mesas t ON t.id = o.mesa_id
       LEFT JOIN clientes c ON c.id = o.cliente_id
       LEFT JOIN pedido_itens oi ON oi.pedido_id = o.id
       LEFT JOIN cardapio_itens mi ON mi.id = oi.cardapio_item_id
       WHERE o.status IN ('recebido', 'em_preparo', 'pronto')
       GROUP BY o.id, t.numero, c.nome
       ORDER BY o.aberto_em ASC`
    );

    return res.json({ queue: result.rows });
  } catch (err) {
    console.error('[kitchen/queue]', err);
    return res.status(500).json({ error: 'Erro ao buscar fila da cozinha.' });
  }
}

module.exports = { getKitchenQueue };
