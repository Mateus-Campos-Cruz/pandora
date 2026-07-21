require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes    = require('./routes/auth.routes');
const usersRoutes   = require('./routes/users.routes');
const tablesRoutes  = require('./routes/tables.routes');
const menuRoutes    = require('./routes/menu.routes');
const ordersRoutes  = require('./routes/orders.routes');
const kitchenRoutes = require('./routes/kitchen.routes');
const historyRoutes = require('./routes/history.routes');
const analyticsRoutes = require('./routes/analytics.routes');

const app = express();

// ── Segurança ──────────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body Parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Logging ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Rotas da API ───────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/users',   usersRoutes);
app.use('/api/tables',  tablesRoutes);
app.use('/api/menu',    menuRoutes);
app.use('/api/orders',  ordersRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/history', historyRoutes);
const financeRoutes = require('./routes/finance.routes');
app.use('/api/finance', financeRoutes);
app.use('/api/analytics', analyticsRoutes);
const { authenticate } = require('./middleware/auth');
const { authorize } = require('./middleware/authorize');
const ordersController = require('./controllers/orders.controller');
app.get('/api/pedidos/atualizacoes', authenticate, authorize('admin', 'atendente', 'cozinha'), ordersController.getOrderUpdates);

// ── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
});

// ── Error Handler Global ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[UNCAUGHT ERROR]', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

module.exports = app;
