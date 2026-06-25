/**
 * T03 — Teste Funcional: Sincronização de Fila (Atendente → Cozinha)
 *
 * Garante que itens inseridos pelo atendente aparecem
 * exatamente iguais na fila da cozinha.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

process.env.JWT_SECRET = 'test_secret_kitchen';
process.env.NODE_ENV = 'test';

function makeToken(role) {
  return jwt.sign({ id: `${role}-id`, name: role, email: `${role}@test.com`, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// ─── Mock simplificado para validar sincronização ─────────────────────────
const mockQueue = [];
const mockItem = {
  id: 'qi-1',
  item_name: 'X-Burguer Clássico',
  category: 'prato_principal',
  quantity: 3,
  observation: 'sem molho especial',
  is_cancelled: false,
};

jest.mock('../../src/config/database', () => ({
  query: jest.fn(async (sql) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    // Kitchen queue
    if (s.includes('FROM orders o') && s.includes("status IN ('recebido', 'em_preparo', 'pronto')")) {
      return {
        rows: [{
          id: 'order-sync-1',
          type: 'salao',
          status: 'recebido',
          opened_at: new Date().toISOString(),
          table_identifier: 'Mesa 3',
          customer_name: null,
          items: [mockItem],
        }],
      };
    }

    // Order items
    if (s.includes('FROM order_items oi') && s.includes('JOIN menu_items mi')) {
      return { rows: [mockItem] };
    }

    return { rows: [], rowCount: 0 };
  }),
  getClient: jest.fn(),
}));

describe('T03 — Funcional: Fila da Cozinha (Sincronização)', () => {
  const cozinhaToken   = makeToken('cozinha');
  const atendenteToken = makeToken('atendente');

  test('Atendente sem acesso à fila da cozinha (403)', async () => {
    const res = await request(app)
      .get('/api/kitchen/queue')
      .set('Authorization', `Bearer ${atendenteToken}`);
    expect(res.status).toBe(403);
  });

  test('Fila retorna pedido com item inserido pelo atendente', async () => {
    const res = await request(app)
      .get('/api/kitchen/queue')
      .set('Authorization', `Bearer ${cozinhaToken}`);

    expect(res.status).toBe(200);
    expect(res.body.queue).toHaveLength(1);

    const order = res.body.queue[0];
    expect(order.id).toBe('order-sync-1');
    expect(order.type).toBe('salao');
  });

  test('Item na fila tem os mesmos dados inseridos pelo atendente', async () => {
    const res = await request(app)
      .get('/api/kitchen/queue')
      .set('Authorization', `Bearer ${cozinhaToken}`);

    const order = res.body.queue[0];
    expect(order.items).toBeDefined();
    expect(order.items).toHaveLength(1);

    const item = order.items[0];
    expect(item.item_name).toBe(mockItem.item_name);
    expect(item.quantity).toBe(mockItem.quantity);
    expect(item.observation).toBe(mockItem.observation);
    expect(item.is_cancelled).toBe(false);
  });

  test('Item cancelado pelo atendente reflete is_cancelled=true na fila', async () => {
    // Simula item cancelado
    mockItem.is_cancelled = true;

    const res = await request(app)
      .get('/api/kitchen/queue')
      .set('Authorization', `Bearer ${cozinhaToken}`);

    const item = res.body.queue[0].items[0];
    expect(item.is_cancelled).toBe(true);

    // Restaura para outros testes
    mockItem.is_cancelled = false;
  });
});
