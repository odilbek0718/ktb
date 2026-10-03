const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error("XATO: DATABASE_URL o'zgaruvchisi topilmadi. .env faylini tekshiring (.env.example dan nusxa oling).");
  process.exit(1);
}

const useSSL = process.env.NODE_ENV === 'production' || process.env.PGSSL === 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error("Kutilmagan ma'lumotlar bazasi xatosi:", err.message);
});

// Oddiy so'rov: query(sql, params) -> { rows }
function query(sql, params = []) {
  return pool.query(sql, params);
}

// Tranzaksiya: fn(client) ichida xato bo'lsa ROLLBACK, aks holda COMMIT
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// UNIQUE cheklov buzilganini aniqlash (masalan, login band)
function isUniqueViolation(err) {
  return !!err && err.code === '23505';
}

module.exports = { pool, query, transaction, isUniqueViolation };
