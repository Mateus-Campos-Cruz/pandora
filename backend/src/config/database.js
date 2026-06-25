const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexão:', err);
});

/**
 * Executa uma query no banco de dados.
 * @param {string} text - SQL query
 * @param {Array} params - Parâmetros da query
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  if (process.env.NODE_ENV === 'development') {
    console.log('[DB]', { text: text.slice(0, 80), duration: `${duration}ms`, rows: res.rowCount });
  }

  return res;
}

/**
 * Retorna um cliente dedicado para transações.
 */
async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
