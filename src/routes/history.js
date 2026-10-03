const express = require('express');
const pool = require('../db');
const { authRequired, staffOnly } = require('../middleware/auth');

const router = express.Router();

// ============ MENING TARIXIM (o'quvchi uchun) ============
router.get('/me', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT co.id, co.borrowed_at, co.due_at, co.returned_at, b.title, b.author, b.cover_url
       FROM checkouts co
       JOIN books b ON co.book_id = b.id
       WHERE co.user_id = $1
       ORDER BY co.borrowed_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('My history error:', err.message);
    res.status(500).json({ error: 'Tarixni yuklashda xatolik' });
  }
});

// ============ MAKTAB TARIXI (xodim uchun, barcha o'quvchilar) ============
router.get('/school', authRequired, staffOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT co.id, co.borrowed_at, co.due_at, co.returned_at,
              b.title, b.author, u.full_name AS student_name, u.phone AS student_phone
       FROM checkouts co
       JOIN books b ON co.book_id = b.id
       JOIN users u ON co.user_id = u.id
       WHERE b.school_id = $1
       ORDER BY co.borrowed_at DESC
       LIMIT 300`,
      [req.user.schoolId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('School history error:', err.message);
    res.status(500).json({ error: 'Tarixni yuklashda xatolik' });
  }
});

module.exports = router;
