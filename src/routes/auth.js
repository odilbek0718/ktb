const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function clean(str) {
  return (str || '').toString().trim();
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, schoolId: user.school_id, login: user.login },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// ============ RO'YXATDAN O'TISH ============
router.post('/register', async (req, res) => {
  try {
    let { fullName, phone, schoolName, role, login, password } = req.body;
    fullName = clean(fullName);
    phone = clean(phone);
    schoolName = clean(schoolName);
    login = clean(login).toLowerCase();
    role = role === 'staff' ? 'staff' : 'student';

    if (!fullName || fullName.split(' ').filter(Boolean).length < 2) {
      return res.status(400).json({ error: "Iltimos, to'liq ism va familiyangizni kiriting" });
    }
    if (!schoolName) {
      return res.status(400).json({ error: 'Maktab nomini yoki raqamini kiriting' });
    }
    if (!login || login.length < 3 || !/^[a-z0-9_.]+$/.test(login)) {
      return res.status(400).json({ error: "Login kamida 3 belgi, faqat lotin harflari va raqamlardan iborat bo'lsin" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Parol kamida 6 belgidan iborat bo'lishi kerak" });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE login=$1', [login]);
    if (existingUser.rows.length) {
      return res.status(409).json({ error: "Bu login band, boshqa login tanlang" });
    }

    let schoolRes = await pool.query('SELECT id, name FROM schools WHERE lower(name)=lower($1)', [schoolName]);
    let schoolId, resolvedSchoolName;
    if (schoolRes.rows.length) {
      schoolId = schoolRes.rows[0].id;
      resolvedSchoolName = schoolRes.rows[0].name;
    } else {
      const ins = await pool.query('INSERT INTO schools(name) VALUES($1) RETURNING id, name', [schoolName]);
      schoolId = ins.rows[0].id;
      resolvedSchoolName = ins.rows[0].name;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userRes = await pool.query(
      `INSERT INTO users(login, password_hash, role, full_name, phone, school_id)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id, login, role, full_name, phone, school_id`,
      [login, passwordHash, role, fullName, phone || null, schoolId]
    );
    const user = userRes.rows[0];
    const token = signToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        login: user.login,
        role: user.role,
        fullName: user.full_name,
        phone: user.phone,
        schoolName: resolvedSchoolName,
      },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: "Bu login band, boshqa login tanlang" });
    }
    console.error('Register error:', err.message);
    res.status(500).json({ error: "Server xatosi yuz berdi, birozdan so'ng qayta urinib ko'ring" });
  }
});

// ============ KIRISH ============
router.post('/login', async (req, res) => {
  try {
    let { login, password } = req.body;
    login = clean(login).toLowerCase();
    if (!login || !password) {
      return res.status(400).json({ error: 'Login va parolni kiriting' });
    }

    const result = await pool.query(
      `SELECT u.*, s.name AS school_name FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE u.login = $1`,
      [login]
    );
    if (!result.rows.length) {
      return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
    }
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        login: user.login,
        role: user.role,
        fullName: user.full_name,
        phone: user.phone,
        schoolName: user.school_name,
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: "Server xatosi yuz berdi, birozdan so'ng qayta urinib ko'ring" });
  }
});

// ============ JORIY FOYDALANUVCHI ============
router.get('/me', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.login, u.role, u.full_name, u.phone, s.name AS school_name
       FROM users u LEFT JOIN schools s ON u.school_id = s.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    const u = result.rows[0];
    res.json({
      id: u.id,
      login: u.login,
      role: u.role,
      fullName: u.full_name,
      phone: u.phone,
      schoolName: u.school_name,
    });
  } catch (err) {
    console.error('Me error:', err.message);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;
