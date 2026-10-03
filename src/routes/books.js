const express = require('express');
const { query, transaction } = require('../db');
const { authRequired, staffOnly } = require('../middleware/auth');

const router = express.Router();
const RENT_DAYS = 14;

router.use(authRequired);

// ID butun son ekanini tekshirish (aks holda PostgreSQL 500 xato beradi)
function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Tranzaksiya ichidan HTTP javobni qaytarish uchun yordamchi xato
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ============ KITOBLAR RO'YXATI (maktab bo'yicha) ============
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT
         b.id, b.title, b.author, b.cover_url, b.status, b.created_at,
         co.id AS checkout_id, co.due_at, co.borrowed_at,
         u.id AS student_id, u.full_name AS student_name
       FROM books b
       LEFT JOIN checkouts co ON co.book_id = b.id AND co.returned_at IS NULL
       LEFT JOIN users u ON co.user_id = u.id
       WHERE b.school_id = $1
       ORDER BY b.created_at DESC, b.id DESC`,
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
    const result = await query(
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

  try {
    const result = await transaction(async (client) => {
      const bookRes = await client.query(
        'SELECT * FROM books WHERE id = $1 AND school_id = $2 FOR UPDATE',
        [bookId, req.user.schoolId]
      );
      if (!bookRes.rows.length) throw new HttpError(404, 'Kitob topilmadi');
      if (bookRes.rows[0].status === 'borrowed') throw new HttpError(409, "Bu kitob allaqachon o'quvchida");

      const studentRes = await client.query(
        "SELECT id, full_name FROM users WHERE id = $1 AND school_id = $2 AND role = 'student'",
        [studentId, req.user.schoolId]
      );
      if (!studentRes.rows.length) throw new HttpError(404, "O'quvchi topilmadi");

      const dueAt = new Date(Date.now() + RENT_DAYS * 24 * 60 * 60 * 1000);
      await client.query(
        'INSERT INTO checkouts(book_id, user_id, staff_id, due_at) VALUES($1,$2,$3,$4)',
        [bookId, studentId, req.user.id, dueAt]
      );
      await client.query("UPDATE books SET status = 'borrowed' WHERE id = $1", [bookId]);

      return { success: true, dueAt, studentName: studentRes.rows[0].full_name };
    });
    res.json(result);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Kitobni berishda xatolik' });
  }
});

// ============ KITOBNI QAYTARIB OLISH (faqat xodim) ============
router.post('/:id/return', staffOnly, async (req, res) => {
  const bookId = parseId(req.params.id);
  if (!bookId) return res.status(404).json({ error: 'Kitob topilmadi' });

  try {
    await transaction(async (client) => {
      const bookRes = await client.query(
        'SELECT * FROM books WHERE id = $1 AND school_id = $2 FOR UPDATE',
        [bookId, req.user.schoolId]
      );
      if (!bookRes.rows.length) throw new HttpError(404, 'Kitob topilmadi');
      if (bookRes.rows[0].status !== 'borrowed') throw new HttpError(409, 'Bu kitob allaqachon javonda');

      await client.query(
        'UPDATE checkouts SET returned_at = now() WHERE book_id = $1 AND returned_at IS NULL',
        [bookId]
      );
      await client.query("UPDATE books SET status = 'available' WHERE id = $1", [bookId]);
    });
    res.json({ success: true });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error('Return error:', err.message);
    res.status(500).json({ error: 'Kitobni qaytarishda xatolik' });
  }
});

module.exports = router;
