const express = require('express');
const pool = require('../db');
const { authRequired, staffOnly } = require('../middleware/auth');

const router = express.Router();

// ============ O'QUVCHILARNI QIDIRISH (xodim uchun, kitob berishda) ============
router.get('/', authRequired, staffOnly, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const result = await pool.query(
      `SELECT id, full_name, login, phone FROM users
       WHERE school_id=$1 AND role='student' AND full_name ILIKE $2
       ORDER BY full_name LIMIT 20`,
      [req.user.schoolId, `%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Search students error:', err.message);
    res.status(500).json({ error: "O'quvchilarni qidirishda xatolik" });
  }
});

module.exports = router;
