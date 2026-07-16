const db = require('../config/database');

/**
 * GET /api/orders — Listar pedidos ativos (atendente/admin)
 */
async function listActiveOrders(req, res) {
  try {
    const result = await db.query(
      `SELECT
         o.id, o.tipo AS type, o.status,
         c.nome AS customer_name, c.telefone AS customer_phone, o.endereco_entrega AS customer_address,
         o.aberto_em AS opened_at, '' AS notes,
         t.numero as table_identifier,
         u.nome as attendant_name,
         COUNT(oi.id) FILTER (WHERE oi.cancelado = false) as item_count,
         0 as total
       FROM pedidos o
       LEFT JOIN mesas t ON t.id = o.mesa_id
       LEFT JOIN clientes c ON c.id = o.cliente_id
       LEFT JOIN usuarios u ON u.id = o.atendente_id
       LEFT JOIN pedido_itens oi ON oi.pedido_id = o.id
       WHERE o.status NOT IN ('encerrado')
       GROUP BY o.id, t.numero, c.nome, c.telefone, u.nome
       ORDER BY o.aberto_em ASC`
    );

    return res.json({ orders: result.rows });
  } catch (err) {
    console.error('[orders/listActive]', err);
    return res.status(500).json({ error: 'Erro ao listar pedidos.' });
  }
}

/**
 * GET /api/orders/:id — Detalhe de um pedido com itens
 */
async function getOrder(req, res) {
  const { id } = req.params;

  try {
    const orderResult = await db.query(
      `SELECT
         o.id, o.tipo AS type, o.status,
         c.nome AS customer_name, c.telefone AS customer_phone, o.endereco_entrega AS customer_address,
         o.aberto_em AS opened_at, o.encerrado_em AS closed_at, '' AS notes,
         t.numero as table_identifier,
         u.nome as attendant_name
       FROM pedidos o
       LEFT JOIN mesas t ON t.id = o.mesa_id
       LEFT JOIN clientes c ON c.id = o.cliente_id
       LEFT JOIN usuarios u ON u.id = o.atendente_id
       WHERE o.id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const itemsResult = await db.query(
      `SELECT
         oi.id, oi.quantidade AS quantity, oi.preco_unitario AS unit_price, oi.observacao AS observation, oi.cancelado AS is_cancelled,
         mi.nome as item_name, mi.categoria AS category
       FROM pedido_itens oi
       JOIN cardapio_itens mi ON mi.id = oi.cardapio_item_id
       WHERE oi.pedido_id = $1
       ORDER BY oi.adicionado_em ASC`,
      [id]
    );

    const statusLogResult = await db.query(
      `SELECT l.status_anterior AS from_status, l.status_novo AS to_status, l.alterado_em AS changed_at, '' AS notes, u.nome as changed_by
       FROM pedido_status_historico l
       JOIN usuarios u ON u.id = l.alterado_por
       WHERE l.pedido_id = $1
       ORDER BY l.alterado_em ASC`,
      [id]
    );

    return res.json({
      order: orderResult.rows[0],
      items: itemsResult.rows,
      statusLog: statusLogResult.rows,
    });
  } catch (err) {
    console.error('[orders/get]', err);
    return res.status(500).json({ error: 'Erro ao buscar pedido.' });
  }
}

/**
 * POST /api/orders — Abrir pedido (atendente/admin)
 */
async function createOrder(req, res) {
  const { type, table_id, customer_name, customer_phone, customer_address, notes } = req.body;

  if (!type || !['salao', 'delivery'].includes(type)) {
    return res.status(400).json({ error: "Tipo de pedido inválido. Use 'salao' ou 'delivery'." });
  }

  if (type === 'salao' && !table_id) {
    return res.status(400).json({ error: 'Mesa é obrigatória para pedido de salão.' });
  }

  if (type === 'delivery' && (!customer_name || !customer_phone || !customer_address)) {
    return res.status(400).json({
      error: 'Nome, telefone e endereço são obrigatórios para delivery.',
    });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Verificar se mesa já tem pedido ativo
    if (type === 'salao') {
      const tableCheck = await client.query(
        `SELECT id FROM pedidos
         WHERE mesa_id = $1
           AND status NOT IN ('entregue', 'encerrado')`,
        [table_id]
      );

      if (tableCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Esta mesa já possui um pedido ativo.' });
      }
    }

    // Gerenciar Cliente para pedidos
    let cliente_id = null;
    if (customer_phone) {
      const clientCheck = await client.query(
        'SELECT id FROM clientes WHERE telefone = $1',
        [customer_phone.trim()]
      );
      if (clientCheck.rows.length > 0) {
        cliente_id = clientCheck.rows[0].id;
      } else {
        const newClient = await client.query(
          'INSERT INTO clientes (nome, telefone, endereco_padrao) VALUES ($1, $2, $3) RETURNING id',
          [customer_name?.trim() || 'Cliente Delivery', customer_phone.trim(), customer_address || null]
        );
        cliente_id = newClient.rows[0].id;
      }
    } else if (customer_name && type === 'salao') {
      // Se tiver nome do cliente em mesa, cadastra como avulso sem telefone obrigatório caso queira ou cria com id fixo.
      // Como telefone em clientes é UNIQUE e NOT NULL, geramos um provisório se necessário.
      const provisorioTelefone = 'SALAO-' + Date.now();
      const newClient = await client.query(
        'INSERT INTO clientes (nome, telefone) VALUES ($1, $2) RETURNING id',
        [customer_name.trim(), provisorioTelefone]
      );
      cliente_id = newClient.rows[0].id;
    }

    // Criar pedido
    const orderResult = await client.query(
      `INSERT INTO pedidos
         (tipo, mesa_id, cliente_id, atendente_id, endereco_entrega)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tipo AS type, status, mesa_id AS table_id, aberto_em AS opened_at`,
      [
        type,
        table_id || null,
        cliente_id,
        req.user.id,
        type === 'delivery' ? customer_address : null
      ]
    );

    const order = orderResult.rows[0];

    // Registrar status inicial no log
    await client.query(
      `INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, alterado_por)
       VALUES ($1, NULL, 'recebido', $2)`,
      [order.id, req.user.id]
    );

    // Marcar mesa como ocupada
    if (type === 'salao') {
      await client.query(
        `UPDATE mesas SET status = 'ocupada' WHERE id = $1`,
        [table_id]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({ order });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[orders/create]', err);
    return res.status(500).json({ error: 'Erro ao abrir pedido.' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/orders/:id/items — Adicionar item ao pedido
 */
async function addItem(req, res) {
  const { id } = req.params;
  const { menu_item_id, quantity, observation } = req.body;

  if (!menu_item_id || !quantity || quantity < 1) {
    return res.status(400).json({ error: 'menu_item_id e quantity (>= 1) são obrigatórios.' });
  }

  try {
    // Verificar pedido existe e está em status editável
    const orderResult = await db.query(
      `SELECT id, status FROM pedidos WHERE id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const order = orderResult.rows[0];
    const editableStatuses = ['recebido', 'em_preparo'];

    if (!editableStatuses.includes(order.status)) {
      return res.status(409).json({
        error: `Não é possível adicionar itens em pedido com status '${order.status}'.`,
      });
    }

    // Verificar item do cardápio
    const menuResult = await db.query(
      `SELECT id, nome, preco FROM cardapio_itens WHERE id = $1 AND ativo = true`,
      [menu_item_id]
    );

    if (menuResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item do cardápio não encontrado ou inativo.' });
    }

    const menuItem = menuResult.rows[0];

    const result = await db.query(
      `INSERT INTO pedido_itens (pedido_id, cardapio_item_id, quantidade, observacao, preco_unitario)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, cardapio_item_id AS menu_item_id, quantidade, preco_unitario AS unit_price, observacao AS observation, cancelado AS is_cancelled`,
      [id, menu_item_id, quantity, observation?.trim() || null, menuItem.preco]
    );

    return res.status(201).json({
      item: { ...result.rows[0], item_name: menuItem.nome },
    });
  } catch (err) {
    console.error('[orders/addItem]', err);
    return res.status(500).json({ error: 'Erro ao adicionar item.' });
  }
}

/**
 * PATCH /api/orders/:id/items/:itemId — Editar ou cancelar item (com justificativa)
 */
async function updateItem(req, res) {
  const { id, itemId } = req.params;
  const { action, justification, quantity, observation } = req.body;

  if (!action || !['edit', 'cancel'].includes(action)) {
    return res.status(400).json({ error: "action deve ser 'edit' ou 'cancel'." });
  }

  if (!justification || justification.trim().length < 5) {
    return res.status(400).json({ error: 'Justificativa obrigatória (mínimo 5 caracteres).' });
  }

  try {
    // Buscar item e verificar status do pedido
    const itemResult = await db.query(
      `SELECT oi.id, oi.quantidade AS quantity, oi.observacao AS observation, oi.cancelado AS is_cancelled,
              o.status as order_status, mi.nome as item_name
       FROM pedido_itens oi
       JOIN pedidos o ON o.id = oi.pedido_id
       JOIN cardapio_itens mi ON mi.id = oi.cardapio_item_id
       WHERE oi.id = $1 AND oi.pedido_id = $2`,
      [itemId, id]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    const item = itemResult.rows[0];

    if (item.is_cancelled) {
      return res.status(409).json({ error: 'Item já foi cancelado.' });
    }

    const editableStatuses = ['recebido', 'em_preparo'];
    if (!editableStatuses.includes(item.order_status)) {
      return res.status(409).json({
        error: `Edições não permitidas em pedido com status '${item.order_status}'.`,
      });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      let updatedItem;

      if (action === 'cancel') {
        const res2 = await client.query(
          `UPDATE pedido_itens
           SET cancelado = true, cancelado_motivo = $2, cancelado_por = $3, cancelado_em = NOW()
           WHERE id = $1 RETURNING id, cardapio_item_id AS menu_item_id, quantidade, preco_unitario AS unit_price, observacao AS observation, cancelado AS is_cancelled`,
          [itemId, justification.trim(), req.user.id]
        );
        updatedItem = res2.rows[0];
      } else {
        if (!quantity && !observation) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Para editar, informe quantity e/ou observation.' });
        }

        const fields = [];
        const values = [];
        let idx = 1;

        if (quantity)    { fields.push(`quantidade = $${idx++}`);    values.push(quantity); }
        if (observation !== undefined) { fields.push(`observacao = $${idx++}`); values.push(observation?.trim() || null); }

        values.push(itemId);
        const res2 = await client.query(
          `UPDATE pedido_itens SET ${fields.join(', ')} WHERE id = $${idx}
           RETURNING id, cardapio_item_id AS menu_item_id, quantidade, preco_unitario AS unit_price, observacao AS observation, cancelado AS is_cancelled`,
          values
        );
        updatedItem = res2.rows[0];
      }

      // Registrar na auditoria
      await client.query(
        `INSERT INTO audit_log (usuario_id, acao, tabela_afetada, registro_id, detalhe)
         VALUES ($1, $2, 'pedido_itens', $3, $4)`,
        [
          req.user.id,
          action === 'cancel' ? 'item_cancelado' : 'item_editado',
          itemId,
          `justificativa: ${justification.trim()}`
        ]
      );

      await client.query('COMMIT');
      return res.json({ item: updatedItem });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[orders/updateItem]', err);
    return res.status(500).json({ error: 'Erro ao editar item.' });
  }
}

/**
 * PATCH /api/orders/:id/status — Avançar status do pedido
 * Fluxo: recebido → em_preparo → pronto (cozinha) → entregue → encerrado (atendente)
 */
async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status, notes } = req.body || {};

  const validTransitions = {
    recebido:   { next: 'em_preparo', roles: ['cozinha', 'admin'] },
    em_preparo: { next: 'pronto',     roles: ['cozinha', 'admin'] },
    pronto:     { next: 'entregue',   roles: ['atendente', 'admin'] },
  };

  try {
    const orderResult = await db.query(
      `SELECT o.id, o.status, o.mesa_id, o.tipo
       FROM pedidos o
       WHERE o.id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const order = orderResult.rows[0];
    const transition = validTransitions[order.status];

    if (!transition) {
      return res.status(409).json({ error: `Pedido já está no status final '${order.status}'.` });
    }

    if (status && status !== transition.next) {
      return res.status(400).json({
        error: `Transição inválida. De '${order.status}' só é possível ir para '${transition.next}'.`,
      });
    }

    if (!transition.roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Perfil '${req.user.role}' não pode avançar de '${order.status}' para '${transition.next}'.`,
      });
    }

    // Validação: ao iniciar preparo, o pedido precisa ter pelo menos 1 item ativo
    if (order.status === 'recebido') {
      const itemCheck = await db.query(
        `SELECT COUNT(*) AS total FROM pedido_itens WHERE pedido_id = $1 AND cancelado = false`,
        [id]
      );
      if (parseInt(itemCheck.rows[0].total, 10) === 0) {
        return res.status(400).json({
          error: 'Não é possível iniciar o preparo: o pedido não possui nenhum item.',
        });
      }
    }

    const newStatus = transition.next;

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Atualizar status do pedido
      await client.query(
        `UPDATE pedidos SET status = $1 WHERE id = $2`,
        [newStatus, id]
      );

      // Log de histórico
      await client.query(
        `INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, alterado_por)
         VALUES ($1, $2, $3, $4)`,
        [id, order.status, newStatus, req.user.id]
      );

      // Se encerrado e for salão, liberar mesa
      if (newStatus === 'encerrado' && order.mesa_id) {
        await client.query(
          `UPDATE mesas SET status = 'livre' WHERE id = $1`,
          [order.mesa_id]
        );
      }

      await client.query('COMMIT');

      return res.json({
        message: `Pedido atualizado para '${newStatus}'.`,
        order_id: id,
        new_status: newStatus,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[orders/updateStatus]', err);
    return res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
}

/**
 * GET /api/pedidos/atualizacoes?desde=<timestamp>
 * Rota para polling do frontend
 */
async function getOrderUpdates(req, res) {
  const { desde } = req.query;
  const client = await db.getClient();
  
  try {
    let query, params;
    if (desde) {
      query = `
        SELECT
         o.id, o.tipo, o.status,
         o.mesa_id, t.numero AS mesa_numero,
         c.nome AS cliente_nome, c.telefone AS cliente_telefone,
         u.nome AS atendente_nome,
         o.aberto_em, o.atualizado_em
        FROM pedidos o
        LEFT JOIN mesas t ON t.id = o.mesa_id
        LEFT JOIN clientes c ON c.id = o.cliente_id
        LEFT JOIN usuarios u ON u.id = o.atendente_id
        WHERE o.atualizado_em > $1 AND o.status != 'encerrado'
        ORDER BY o.atualizado_em ASC
      `;
      params = [desde];
    } else {
      query = `
        SELECT
         o.id, o.tipo, o.status,
         o.mesa_id, t.numero AS mesa_numero,
         c.nome AS cliente_nome, c.telefone AS cliente_telefone,
         u.nome AS atendente_nome,
         o.aberto_em, o.atualizado_em
        FROM pedidos o
        LEFT JOIN mesas t ON t.id = o.mesa_id
        LEFT JOIN clientes c ON c.id = o.cliente_id
        LEFT JOIN usuarios u ON u.id = o.atendente_id
        WHERE o.status != 'encerrado'
        ORDER BY o.atualizado_em ASC
      `;
      params = [];
    }

    const ordersResult = await client.query(query, params);
    const pedidos = [];
    
    if (ordersResult.rows.length > 0) {
      const orderIds = ordersResult.rows.map(r => r.id);
      
      const itemsResult = await client.query(`
        SELECT oi.id, oi.pedido_id, mi.nome, mi.categoria, oi.quantidade, oi.observacao, oi.cancelado, oi.preco_unitario
        FROM pedido_itens oi
        JOIN cardapio_itens mi ON mi.id = oi.cardapio_item_id
        WHERE oi.pedido_id = ANY($1)
        ORDER BY oi.adicionado_em ASC
      `, [orderIds]);
      
      const itemsMap = {};
      for (const item of itemsResult.rows) {
        if (!itemsMap[item.pedido_id]) itemsMap[item.pedido_id] = [];
        itemsMap[item.pedido_id].push({
          id: item.id,
          nome: item.nome,
          categoria: item.categoria,
          quantidade: item.quantidade,
          observacao: item.observacao,
          preco_unitario: item.preco_unitario,
          cancelado: item.cancelado
        });
      }
      
      for (const row of ordersResult.rows) {
        pedidos.push({
          id: row.id,
          tipo: row.tipo,
          status: row.status,
          mesa_id: row.mesa_id,
          mesa_numero: row.mesa_numero,
          cliente_nome: row.cliente_nome,
          cliente_telefone: row.cliente_telefone,
          atendente_nome: row.atendente_nome,
          aberto_em: row.aberto_em,
          atualizado_em: row.atualizado_em,
          itens: itemsMap[row.id] || []
        });
      }
    }

    const timeResult = await client.query(`SELECT NOW() AS current_time`);
    const serverTimestamp = timeResult.rows[0].current_time;

    // Polling não afeta um registro específico — omitimos o audit_log para não gerar erros
    // (tabela_afetada e registro_id são NOT NULL e não fazem sentido para uma leitura)

    return res.json({
      pedidos,
      timestamp_servidor: serverTimestamp
    });

  } catch (err) {
    console.error('[orders/getOrderUpdates]', err);
    return res.status(500).json({ error: 'Erro ao buscar atualizações de pedidos.' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/orders/:id/pay — Registrar pagamento e encerrar pedido
 */
async function payOrder(req, res) {
  const { id } = req.params;
  const { forma_pagamento, valor_recebido } = req.body;

  if (!['dinheiro', 'pix', 'debito', 'credito'].includes(forma_pagamento)) {
    return res.status(400).json({ error: 'Forma de pagamento inválida.' });
  }

  const valorRec = parseFloat(valor_recebido) || 0;
  if (forma_pagamento === 'dinheiro' && valorRec <= 0) {
    return res.status(400).json({ error: 'Valor recebido deve ser maior que 0 para pagamento em dinheiro.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Buscar pedido para verificar status
    const orderResult = await client.query(
      `SELECT status, mesa_id FROM pedidos WHERE id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const order = orderResult.rows[0];
    if (order.status !== 'entregue') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Pedido só pode ser pago/encerrado a partir do status entregue.' });
    }

    // Calcular total do pedido (ignorar cancelados)
    const itemsResult = await client.query(
      `SELECT SUM(quantidade * preco_unitario) as total
       FROM pedido_itens 
       WHERE pedido_id = $1 AND cancelado = false`,
      [id]
    );
    
    const valorTotal = parseFloat(itemsResult.rows[0].total) || 0;

    let finalValorRecebido = valorRec;
    let troco = 0;

    if (forma_pagamento === 'dinheiro') {
      if (finalValorRecebido < valorTotal) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Valor recebido menor que o total do pedido.' });
      }
      troco = finalValorRecebido - valorTotal;
    } else {
      finalValorRecebido = valorTotal; // Cartão/Pix sempre é exatamente o valor
    }

    // Registrar pagamento
    await client.query(
      `INSERT INTO pagamentos 
        (pedido_id, forma_pagamento, valor_total, valor_recebido, troco, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, forma_pagamento, valorTotal, finalValorRecebido, troco, req.user.id]
    );

    // Atualizar status para encerrado
    await client.query(
      `UPDATE pedidos SET status = 'encerrado' WHERE id = $1`,
      [id]
    );

    // Log de histórico de status
    await client.query(
      `INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, alterado_por)
       VALUES ($1, 'entregue', 'encerrado', $2)`,
      [id, req.user.id]
    );

    // Liberar mesa se salão
    if (order.mesa_id) {
      await client.query(
        `UPDATE mesas SET status = 'livre' WHERE id = $1`,
        [order.mesa_id]
      );
    }

    await client.query('COMMIT');
    
    return res.status(200).json({ message: 'Pagamento registrado e pedido encerrado com sucesso.', troco });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[orders/payOrder]', err);
    return res.status(500).json({ error: 'Erro ao registrar pagamento.' });
  } finally {
    client.release();
  }
}

module.exports = {
  listActiveOrders,
  getOrder,
  createOrder,
  addItem,
  updateItem,
  updateOrderStatus,
  getOrderUpdates,
  payOrder,
};
