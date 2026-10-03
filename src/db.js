const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('XATO: DATABASE_URL o\'zgaruvchisi topilmadi. .env faylini tekshiring (.env.example dan nusxa oling).');
  process.exit(1);
}

const useSSL = process.env.NODE_ENV === 'production' || process.env.PGSSL === 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Kutilmagan ma\'lumotlar bazasi xatosi:', err.message);
});

module.exports = pool;
