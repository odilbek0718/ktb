const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function migrate() {
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Migratsiya muvaffaqiyatli yakunlandi - barcha jadvallar tayyor.');
  } catch (err) {
    console.error('❌ Migratsiya xatosi:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
