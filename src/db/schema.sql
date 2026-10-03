-- Kutubxonam ma'lumotlar bazasi sxemasi
-- Barcha buyruqlar IF NOT EXISTS bilan - xavfsiz qayta ishga tushirish mumkin

CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  login TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('staff','student')),
  full_name TEXT NOT NULL,
  phone TEXT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','borrowed')),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checkouts (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  borrowed_at TIMESTAMP NOT NULL DEFAULT now(),
  due_at TIMESTAMP NOT NULL,
  returned_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_books_school ON books(school_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_book ON checkouts(book_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_user ON checkouts(user_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_active ON checkouts(book_id) WHERE returned_at IS NULL;
