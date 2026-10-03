const jwt = require('jsonwebtoken');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Sessiya muddati tugagan, qayta kiring" });
  }
}

function staffOnly(req, res, next) {
  if (!req.user || req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Bu amal faqat xodim uchun ruxsat etilgan' });
  }
  next();
}

module.exports = { authRequired, staffOnly };
