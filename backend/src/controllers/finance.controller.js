const db = require('../config/database');

/**
 * GET /api/finance/closing
 * Retorna os dados para fechamento do caixa, baseados na data_referencia (YYYY-MM-DD).
 */
async function getClosingData(req, res) {
  const { date } = req.query;
  
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Data inválida. Use o formato YYYY-MM-DD.' });
  }

  try {
    // Verificar se já existe fechamento
    const fechamentoResult = await db.query(
      `SELECT * FROM fechamento_caixa WHERE data_referencia = $1`,
      [date]
    );

    const alreadyClosed = fechamentoResult.rows.length > 0;
    
    // Obter todos os pagamentos da data e agregar (RF-M2-05)
    // Usaremos a data_referencia como o "dia" do pagamento considerando que 
    // `registrado_em` está sendo casted para DATE localmente.
    // Vamos usar DATE(registrado_em AT TIME ZONE 'America/Sao_Paulo') se possível, mas 
    // um simplificado DATE(registrado_em) será suficiente.
    
    const aggregationResult = await db.query(
      `SELECT
         COUNT(DISTINCT p.pedido_id) as total_pedidos,
         SUM(p.valor_recebido - p.troco) as total_geral,
         COALESCE(SUM(CASE WHEN p.forma_pagamento = 'dinheiro' THEN (p.valor_recebido - p.troco) ELSE 0 END), 0) as total_dinheiro,
         COALESCE(SUM(CASE WHEN p.forma_pagamento = 'pix' THEN (p.valor_recebido - p.troco) ELSE 0 END), 0) as total_pix,
         COALESCE(SUM(CASE WHEN p.forma_pagamento = 'debito' THEN (p.valor_recebido - p.troco) ELSE 0 END), 0) as total_debito,
         COALESCE(SUM(CASE WHEN p.forma_pagamento = 'credito' THEN (p.valor_recebido - p.troco) ELSE 0 END), 0) as total_credito,
         COALESCE(SUM(CASE WHEN pd.tipo = 'salao' THEN (p.valor_recebido - p.troco) ELSE 0 END), 0) as total_salao,
         COALESCE(SUM(CASE WHEN pd.tipo = 'delivery' THEN (p.valor_recebido - p.troco) ELSE 0 END), 0) as total_delivery
       FROM pagamentos p
       JOIN pedidos pd ON pd.id = p.pedido_id
       WHERE DATE(p.registrado_em) = $1`,
      [date]
    );

    const data = aggregationResult.rows[0];
    const total_pedidos = parseInt(data.total_pedidos, 10);
    const total_geral = parseFloat(data.total_geral) || 0;
    const ticket_medio = total_pedidos > 0 ? (total_geral / total_pedidos) : 0;

    return res.json({
      alreadyClosed,
      fechamento: alreadyClosed ? fechamentoResult.rows[0] : null,
      agregado: {
        total_pedidos,
        total_geral,
        total_dinheiro: parseFloat(data.total_dinheiro),
        total_pix: parseFloat(data.total_pix),
        total_debito: parseFloat(data.total_debito),
        total_credito: parseFloat(data.total_credito),
        total_salao: parseFloat(data.total_salao),
        total_delivery: parseFloat(data.total_delivery),
        ticket_medio,
      }
    });

  } catch (err) {
    console.error('[finance/getClosingData]', err);
    return res.status(500).json({ error: 'Erro ao buscar dados do fechamento.' });
  }
}

/**
 * POST /api/finance/closing
 * Registra o fechamento do caixa para o dia.
 */
async function closeRegister(req, res) {
  const { date, total_dinheiro, total_pix, total_debito, total_credito, total_geral } = req.body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Data inválida.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO fechamento_caixa 
        (data_referencia, total_dinheiro, total_pix, total_debito, total_credito, total_geral, fechado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [date, total_dinheiro || 0, total_pix || 0, total_debito || 0, total_credito || 0, total_geral || 0, req.user.id]
    );

    return res.status(201).json({
      message: 'Caixa fechado com sucesso.',
      fechamento: result.rows[0]
    });
  } catch (err) {
    if (err.code === '23505') { // unique violation
      return res.status(409).json({ error: 'O caixa já foi fechado para esta data.' });
    }
    console.error('[finance/closeRegister]', err);
    return res.status(500).json({ error: 'Erro ao fechar caixa.' });
  }
}

module.exports = {
  getClosingData,
  closeRegister
};
