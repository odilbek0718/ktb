const express = require('express');
const pool = require('../db');
const { authRequired, staffOnly } = require('../middleware/auth');

const router = express.Router();
const RENT_DAYS = 14;

router.use(authRequired);

// ID butun son ekanini tekshirish (aks holda PostgreSQL 500 xato beradi)
function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ============ KITOBLAR RO'YXATI (maktab bo'yicha) ============
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         b.id, b.title, b.author, b.cover_url, b.status, b.created_at,
         co.id AS checkout_id, co.due_at, co.borrowed_at,
         u.id AS student_id, u.full_name AS student_name
       FROM books b
       LEFT JOIN checkouts co ON co.book_id = b.id AND co.returned_at IS NULL
       LEFT JOIN users u ON co.user_id = u.id
       WHERE b.school_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.schoolId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List books error:', err.message);
    res.status(500).json({ error: 'Kitoblarni yuklashda xatolik' });
  }
});

// ============ YANGI KITOB QO'SHISH (faqat xodim) ============
router.post('/', staffOnly, async (req, res) => {
  try {
    let { title, author, coverUrl } = req.body;
    title = (title || '').toString().trim();
    author = (author || '').toString().trim();
    if (!title || !author) {
      return res.status(400).json({ error: 'Kitob nomi va muallifini kiriting' });
    }
    if (coverUrl && !/^data:image\/(jpeg|png|webp);base64,/.test(coverUrl)) {
      return res.status(400).json({ error: "Muqova rasmi formati noto'g'ri" });
    }
    const result = await pool.query(
      `INSERT INTO books(school_id, title, author, cover_url, status)
       VALUES($1,$2,$3,$4,'available') RETURNING *`,
      [req.user.schoolId, title, author, coverUrl || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add book error:', err.message);
    res.status(500).json({ error: "Kitob qo'shishda xatolik" });
  }
});

// ============ KITOBNI BERISH (faqat xodim, 2 haftaga) ============
router.post('/:id/checkout', staffOnly, async (req, res) => {
  const bookId = parseId(req.params.id);
  const studentId = parseId(req.body && req.body.studentId);
  if (!bookId) return res.status(404).json({ error: 'Kitob topilmadi' });
  if (!studentId) return res.status(400).json({ error: "O'quvchini tanlang" });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const bookRes = await client.query(
      'SELECT * FROM books WHERE id=$1 AND school_id=$2 FOR UPDATE',
      [bookId, req.user.schoolId]
    );
    if (!bookRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Kitob topilmadi' });
    }
    if (bookRes.rows[0].status === 'borrowed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: "Bu kitob allaqachon o'quvchida" });
    }

    const studentRes = await client.query(
      "SELECT id, full_name FROM users WHERE id=$1 AND school_id=$2 AND role='student'",
      [studentId, req.user.schoolId]
    );
    if (!studentRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "O'quvchi topilmadi" });
    }

    const dueAt = new Date(Date.now() + RENT_DAYS * 24 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO checkouts(book_id, user_id, staff_id, due_at) VALUES($1,$2,$3,$4)`,
      [bookId, studentId, req.user.id, dueAt]
    );
    await client.query(`UPDATE books SET status='borrowed' WHERE id=$1`, [bookId]);

    await client.query('COMMIT');
    res.json({ success: true, dueAt, studentName: studentRes.rows[0].full_name });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Kitobni berishda xatolik' });
  } finally {
    client.release();
  }
});

// ============ KITOBNI QAYTARIB OLISH (faqat xodim) ============
router.post('/:id/return', staffOnly, async (req, res) => {
  const bookId = parseId(req.params.id);
  if (!bookId) return res.status(404).json({ error: 'Kitob topilmadi' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const bookRes = await client.query(
      'SELECT * FROM books WHERE id=$1 AND school_id=$2 FOR UPDATE',
      [bookId, req.user.schoolId]
    );
    if (!bookRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Kitob topilmadi' });
    }
    if (bookRes.rows[0].status !== 'borrowed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Bu kitob allaqachon javonda' });
    }

    await client.query(
      `UPDATE checkouts SET returned_at = now() WHERE book_id=$1 AND returned_at IS NULL`,
      [bookId]
    );
    await client.query(`UPDATE books SET status='available' WHERE id=$1`, [bookId]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Return error:', err.message);
    res.status(500).json({ error: 'Kitobni qaytarishda xatolik' });
  } finally {
    client.release();
  }
});

module.exports = router;
