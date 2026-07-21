const db = require('../config/database');

/**
 * Helper to build date filters
 */
function getDateFilter(period, customStart, customEnd) {
  let startDate = new Date();
  let endDate = new Date();
  
  if (period === 'hoje') {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (period === '7d') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === '30d') {
    startDate.setDate(startDate.getDate() - 30);
  } else if (period === 'custom' && customStart && customEnd) {
    startDate = new Date(customStart);
    endDate = new Date(customEnd);
    endDate.setHours(23, 59, 59, 999);
  } else {
    // Default to last 30 days
    startDate.setDate(startDate.getDate() - 30);
  }

  return { startDate, endDate };
}

/**
 * GET /api/analytics/dashboard
 * Retorna todos os dados para o painel de desempenho
 */
async function getDashboardData(req, res) {
  const { period, start, end } = req.query;
  const { startDate, endDate } = getDateFilter(period, start, end);

  try {
    // 1. Top 10 itens mais pedidos
    const topItemsResult = await db.query(`
      SELECT 
        ci.nome, 
        SUM(pi.quantidade) as total_vendido
      FROM pedido_itens pi
      JOIN pedidos p ON p.id = pi.pedido_id
      JOIN cardapio_itens ci ON ci.id = pi.cardapio_item_id
      WHERE p.aberto_em >= $1 AND p.aberto_em <= $2
        AND pi.cancelado = FALSE
      GROUP BY ci.id, ci.nome
      ORDER BY total_vendido DESC
      LIMIT 10
    `, [startDate, endDate]);

    // 2. Volume de pedidos por hora e dia da semana
    // Convertendo 'aberto_em' para fuso local para agrupamento
    const volumeResult = await db.query(`
      SELECT 
        EXTRACT(ISODOW FROM (p.aberto_em AT TIME ZONE 'America/Sao_Paulo')) as dia_semana,
        EXTRACT(HOUR FROM (p.aberto_em AT TIME ZONE 'America/Sao_Paulo')) as hora_dia,
        COUNT(p.id) as total_pedidos
      FROM pedidos p
      WHERE p.aberto_em >= $1 AND p.aberto_em <= $2
      GROUP BY dia_semana, hora_dia
      ORDER BY dia_semana, hora_dia
    `, [startDate, endDate]);

    // 3. Tempo de preparo médio por categoria
    // Pega o tempo do pedido (da abertura ou recebido até pronto) e atribui às categorias
    const prepTimeResult = await db.query(`
      WITH order_times AS (
        SELECT 
          p.id as pedido_id,
          EXTRACT(EPOCH FROM (
            MAX(CASE WHEN psh.status_novo = 'pronto' THEN psh.alterado_em END) - 
            MIN(CASE WHEN psh.status_novo = 'em_preparo' THEN psh.alterado_em ELSE p.aberto_em END)
          )) / 60.0 as preparo_minutos
        FROM pedidos p
        LEFT JOIN pedido_status_historico psh ON psh.pedido_id = p.id
        WHERE p.aberto_em >= $1 AND p.aberto_em <= $2
        GROUP BY p.id
        HAVING MAX(CASE WHEN psh.status_novo = 'pronto' THEN 1 ELSE 0 END) = 1
      )
      SELECT 
        ci.categoria,
        AVG(ot.preparo_minutos) as media_preparo_minutos
      FROM order_times ot
      JOIN pedido_itens pi ON pi.pedido_id = ot.pedido_id
      JOIN cardapio_itens ci ON ci.id = pi.cardapio_item_id
      WHERE pi.cancelado = FALSE
      GROUP BY ci.categoria
    `, [startDate, endDate]);

    // 4. Taxa de cancelamento por atendente
    const cancelRateResult = await db.query(`
      WITH itens_atendente AS (
        SELECT 
          u.id as usuario_id,
          u.nome as atendente,
          COUNT(pi.id) as total_itens,
          SUM(CASE WHEN pi.cancelado = TRUE THEN 1 ELSE 0 END) as itens_cancelados
        FROM pedidos p
        JOIN usuarios u ON u.id = p.atendente_id
        JOIN pedido_itens pi ON pi.pedido_id = p.id
        WHERE p.aberto_em >= $1 AND p.aberto_em <= $2
        GROUP BY u.id, u.nome
      )
      SELECT 
        atendente,
        total_itens,
        itens_cancelados,
        CASE WHEN total_itens > 0 THEN (itens_cancelados::FLOAT / total_itens) * 100 ELSE 0 END as taxa_cancelamento
      FROM itens_atendente
      WHERE total_itens > 0
      ORDER BY taxa_cancelamento DESC
    `, [startDate, endDate]);

    // 5. Comparativo Volume e Faturamento (Salão vs Delivery)
    const comparisonResult = await db.query(`
      SELECT 
        p.tipo,
        COUNT(DISTINCT p.id) as total_pedidos,
        COALESCE(SUM(pg.valor_recebido - pg.troco), 0) as faturamento
      FROM pedidos p
      LEFT JOIN pagamentos pg ON pg.pedido_id = p.id
      WHERE p.aberto_em >= $1 AND p.aberto_em <= $2
      GROUP BY p.tipo
    `, [startDate, endDate]);

    // 6. Ticket Médio
    const ticketResult = await db.query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_pedidos,
        COALESCE(SUM(pg.valor_recebido - pg.troco), 0) as faturamento_total
      FROM pedidos p
      JOIN pagamentos pg ON pg.pedido_id = p.id
      WHERE p.aberto_em >= $1 AND p.aberto_em <= $2
    `, [startDate, endDate]);
    
    const ticketRow = ticketResult.rows[0];
    const avgTicket = ticketRow.total_pedidos > 0 
      ? parseFloat(ticketRow.faturamento_total) / parseInt(ticketRow.total_pedidos) 
      : 0;

    // 7. Faturamento diário por método de pagamento
    const revenueByMethodResult = await db.query(`
      SELECT 
        DATE(pg.registrado_em AT TIME ZONE 'America/Sao_Paulo') as data_pagamento,
        pg.forma_pagamento,
        SUM(pg.valor_recebido - pg.troco) as faturamento
      FROM pagamentos pg
      JOIN pedidos p ON p.id = pg.pedido_id
      WHERE p.aberto_em >= $1 AND p.aberto_em <= $2
      GROUP BY data_pagamento, pg.forma_pagamento
      ORDER BY data_pagamento ASC
    `, [startDate, endDate]);

    return res.json({
      period: { startDate, endDate },
      topItems: topItemsResult.rows,
      ordersVolume: volumeResult.rows,
      prepTime: prepTimeResult.rows,
      cancelRate: cancelRateResult.rows,
      salesComparison: comparisonResult.rows,
      averageTicket: avgTicket,
      revenueByMethod: revenueByMethodResult.rows
    });
  } catch (err) {
    console.error('[analytics/getDashboardData]', err);
    return res.status(500).json({ error: 'Erro ao carregar dados do painel.' });
  }
}

module.exports = {
  getDashboardData
};
