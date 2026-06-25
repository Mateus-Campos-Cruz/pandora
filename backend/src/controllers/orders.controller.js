const db = require('../config/database');

/**
 * GET /api/orders — Listar pedidos ativos (atendente/admin)
 */
async function listActiveOrders(req, res) {
  try {
    const result = await db.query(
      `SELECT
         o.id, o.type, o.status,
         o.customer_name, o.customer_phone, o.customer_address,
         o.opened_at, o.notes,
         t.identifier as table_identifier,
         u.name as attendant_name,
         COUNT(oi.id) FILTER (WHERE oi.is_cancelled = false) as item_count,
         SUM(oi.unit_price * oi.quantity) FILTER (WHERE oi.is_cancelled = false) as total
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN users u ON u.id = o.attendant_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.deleted_at IS NULL
         AND o.status NOT IN ('encerrado')
       GROUP BY o.id, t.identifier, u.name
       ORDER BY o.opened_at ASC`
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
         o.id, o.type, o.status,
         o.customer_name, o.customer_phone, o.customer_address,
         o.opened_at, o.closed_at, o.notes,
         t.identifier as table_identifier,
         u.name as attendant_name
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN users u ON u.id = o.attendant_id
       WHERE o.id = $1 AND o.deleted_at IS NULL`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const itemsResult = await db.query(
      `SELECT
         oi.id, oi.quantity, oi.unit_price, oi.observation, oi.is_cancelled,
         mi.name as item_name, mi.category
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE oi.order_id = $1
       ORDER BY oi.created_at ASC`,
      [id]
    );

    const statusLogResult = await db.query(
      `SELECT l.from_status, l.to_status, l.changed_at, l.notes, u.name as changed_by
       FROM order_status_log l
       JOIN users u ON u.id = l.changed_by_user_id
       WHERE l.order_id = $1
       ORDER BY l.changed_at ASC`,
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
        `SELECT id FROM orders
         WHERE table_id = $1 AND deleted_at IS NULL
           AND status NOT IN ('entregue', 'encerrado')`,
        [table_id]
      );

      if (tableCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Esta mesa já possui um pedido ativo.' });
      }
    }

    // Criar pedido
    const orderResult = await client.query(
      `INSERT INTO orders
         (type, table_id, customer_name, customer_phone, customer_address, attendant_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, type, status, table_id, customer_name, opened_at`,
      [
        type,
        table_id || null,
        customer_name || null,
        customer_phone || null,
        customer_address || null,
        req.user.id,
        notes || null,
      ]
    );

    const order = orderResult.rows[0];

    // Registrar status inicial no log
    await client.query(
      `INSERT INTO order_status_log (order_id, from_status, to_status, changed_by_user_id)
       VALUES ($1, NULL, 'recebido', $2)`,
      [order.id, req.user.id]
    );

    // Marcar mesa como ocupada
    if (type === 'salao') {
      await client.query(
        `UPDATE tables SET status = 'ocupada' WHERE id = $1`,
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
      `SELECT id, status FROM orders WHERE id = $1 AND deleted_at IS NULL`,
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
      `SELECT id, price, name FROM menu_items WHERE id = $1 AND deleted_at IS NULL AND is_active = true`,
      [menu_item_id]
    );

    if (menuResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item do cardápio não encontrado ou inativo.' });
    }

    const menuItem = menuResult.rows[0];

    const result = await db.query(
      `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, observation)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, menu_item_id, quantity, unit_price, observation, is_cancelled`,
      [id, menu_item_id, quantity, menuItem.price, observation?.trim() || null]
    );

    return res.status(201).json({
      item: { ...result.rows[0], item_name: menuItem.name },
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
      `SELECT oi.*, o.status as order_status, mi.name as item_name
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE oi.id = $1 AND oi.order_id = $2 AND o.deleted_at IS NULL`,
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
          `UPDATE order_items SET is_cancelled = true WHERE id = $1 RETURNING *`,
          [itemId]
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

        if (quantity)    { fields.push(`quantity = $${idx++}`);    values.push(quantity); }
        if (observation !== undefined) { fields.push(`observation = $${idx++}`); values.push(observation?.trim() || null); }

        values.push(itemId);
        const res2 = await client.query(
          `UPDATE order_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
          values
        );
        updatedItem = res2.rows[0];
      }

      // Registrar na auditoria
      await client.query(
        `INSERT INTO item_edit_log
           (order_item_id, action, justification, performed_by_user_id,
            previous_quantity, new_quantity, previous_observation, new_observation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          itemId, action, justification.trim(), req.user.id,
          item.quantity,
          action === 'edit' ? (quantity || item.quantity) : item.quantity,
          item.observation,
          action === 'edit' ? (observation?.trim() || item.observation) : item.observation,
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
  const { status, notes } = req.body;

  const validTransitions = {
    recebido:   { next: 'em_preparo', roles: ['cozinha', 'admin'] },
    em_preparo: { next: 'pronto',     roles: ['cozinha', 'admin'] },
    pronto:     { next: 'entregue',   roles: ['atendente', 'admin'] },
    entregue:   { next: 'encerrado',  roles: ['atendente', 'admin'] },
  };

  try {
    const orderResult = await db.query(
      `SELECT o.id, o.status, o.table_id, o.type
       FROM orders o
       WHERE o.id = $1 AND o.deleted_at IS NULL`,
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

    const newStatus = transition.next;

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Atualizar status do pedido
      const closed_at = newStatus === 'encerrado' ? 'NOW()' : 'NULL';
      await client.query(
        `UPDATE orders SET status = $1, closed_at = ${newStatus === 'encerrado' ? 'NOW()' : 'closed_at'} WHERE id = $2`,
        [newStatus, id]
      );

      // Log de auditoria
      await client.query(
        `INSERT INTO order_status_log (order_id, from_status, to_status, changed_by_user_id, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, order.status, newStatus, req.user.id, notes || null]
      );

      // Se encerrado, liberar mesa
      if (newStatus === 'encerrado' && order.table_id) {
        await client.query(
          `UPDATE tables SET status = 'livre' WHERE id = $1`,
          [order.table_id]
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

module.exports = {
  listActiveOrders,
  getOrder,
  createOrder,
  addItem,
  updateItem,
  updateOrderStatus,
};
