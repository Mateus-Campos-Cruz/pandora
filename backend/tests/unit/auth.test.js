const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../src/app');

// Garante que a chave JWT existe para os testes
process.env.JWT_SECRET = 'test_secret_for_unit_tests_only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';

describe('T02 — Testes Unitários: Segurança JWT e RBAC', () => {

  // ─── Geração e Validação de Token ──────────────────────────────────────
  describe('JWT — Geração', () => {
    test('deve gerar token com payload correto', () => {
      const payload = { id: 'uuid-1', name: 'Admin', email: 'admin@test.com', role: 'admin' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    test('deve decodificar token com campos corretos', () => {
      const payload = { id: 'uuid-1', name: 'Admin', email: 'admin@test.com', role: 'admin' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      expect(decoded.id).toBe(payload.id);
      expect(decoded.name).toBe(payload.name);
      expect(decoded.role).toBe(payload.role);
    });

    test('deve rejeitar token com chave secreta incorreta', () => {
      const token = jwt.sign({ id: 'uuid-1', role: 'admin' }, 'wrong_secret');
      expect(() => jwt.verify(token, process.env.JWT_SECRET)).toThrow(jwt.JsonWebTokenError);
    });

    test('deve rejeitar token expirado', () => {
      const token = jwt.sign({ id: 'uuid-1', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '0s' });
      // Aguarda 10ms para garantir expiração
      return new Promise((resolve) => setTimeout(() => {
        expect(() => jwt.verify(token, process.env.JWT_SECRET)).toThrow(jwt.TokenExpiredError);
        resolve();
      }, 10));
    });
  });

  // ─── Bloqueio de Rotas sem Token ───────────────────────────────────────
  describe('Middleware auth — 401 Unauthorized', () => {
    test('GET /api/orders deve retornar 401 sem token', async () => {
      const res = await request(app).get('/api/orders');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_TOKEN_MISSING');
    });

    test('GET /api/tables deve retornar 401 sem token', async () => {
      const res = await request(app).get('/api/tables');
      expect(res.status).toBe(401);
    });

    test('GET /api/kitchen/queue deve retornar 401 sem token', async () => {
      const res = await request(app).get('/api/kitchen/queue');
      expect(res.status).toBe(401);
    });

    test('GET /api/users deve retornar 401 sem token', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
    });

    test('deve retornar 401 com token malformado', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', 'Bearer token_invalido_aqui');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_TOKEN_INVALID');
    });
  });

  // ─── Restrição de Perfil Cozinha em Rota Admin ────────────────────────
  describe('Middleware authorize — 403 Forbidden (Cozinha em rota Admin)', () => {
    let cozinhaToken;

    beforeAll(() => {
      cozinhaToken = jwt.sign(
        { id: 'uuid-cozinha', name: 'Cozinha', email: 'cozinha@test.com', role: 'cozinha' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    test('Cozinha tentando GET /api/users deve retornar 403', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${cozinhaToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_FORBIDDEN');
    });

    test('Cozinha tentando POST /api/menu deve retornar 403', async () => {
      const res = await request(app)
        .post('/api/menu')
        .set('Authorization', `Bearer ${cozinhaToken}`)
        .send({ name: 'Teste', category: 'bebida', price: 5 });
      expect(res.status).toBe(403);
    });

    test('Cozinha tentando POST /api/orders deve retornar 403', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${cozinhaToken}`)
        .send({ type: 'delivery', customer_name: 'João', customer_phone: '11999', customer_address: 'Rua A' });
      expect(res.status).toBe(403);
    });

    test('Cozinha pode acessar GET /api/kitchen/queue', async () => {
      // Deve retornar 500 (sem DB real) e NÃO 401/403
      const res = await request(app)
        .get('/api/kitchen/queue')
        .set('Authorization', `Bearer ${cozinhaToken}`);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  // ─── Health Check ──────────────────────────────────────────────────────
  describe('Health Check', () => {
    test('GET /health deve retornar 200', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
