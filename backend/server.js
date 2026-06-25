require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   Pandora API — Gestão de Pedidos   ║
  ╠══════════════════════════════════════╣
  ║  Ambiente : ${(process.env.NODE_ENV || 'development').padEnd(25)}║
  ║  Porta    : ${String(PORT).padEnd(25)}║
  ║  Saúde    : http://localhost:${PORT}/health ║
  ╚══════════════════════════════════════╝
  `);
});
