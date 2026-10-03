# 📚 Kutubxonam — Maktab kutubxonasi boshqaruv tizimi

Node.js (Express) + PostgreSQL asosida qurilgan, real ma'lumotlar bazasi bilan ishlaydigan maktab kutubxonasi tizimi.

## Xususiyatlar

- ✅ Haqiqiy PostgreSQL ma'lumotlar bazasi — kompyuter o'chib-yonganda ham ma'lumotlar saqlanib qoladi
- ✅ Xodim va o'quvchilar o'zlari login va parol tanlab ro'yxatdan o'tadi (bcrypt bilan xavfsiz saqlanadi)
- ✅ Telefon raqami profilga saqlanadi
- ✅ Har bir kitob olish/qaytarish voqeasi **doimiy tarixga** yoziladi (checkouts jadvali)
- ✅ O'quvchi profilida "Mening tarixim" — barcha oldingi olingan kitoblar ro'yxati
- ✅ Xodim "Tarix" bo'limida butun maktab bo'yicha barcha oldi-berdilarni ko'radi
- ✅ Kitob muqovasi — rasm yuklash (avtomatik kichraytiriladi)
- ✅ Muddati tugagan kitoblar haqida bildirishnoma
- ✅ Kunduzgi/tungi rejim

---

## 1-QISM: Kompyuteringizda ishga tushirish (localhost)

### Talab qilinadigan dasturlar
- **Node.js** 18 yoki undan yuqori versiya — https://nodejs.org dan yuklab oling
- **Docker Desktop** (mahalliy PostgreSQL uchun) — https://www.docker.com/products/docker-desktop
  - (Agar Docker ishlatmoqchi bo'lmasangiz, PostgreSQL'ni qo'lda o'rnatishingiz ham mumkin — pastda izoh bor)

### Qadamlar

Terminalni (Mac/Linux: Terminal, Windows: PowerShell yoki CMD) oching va ushbu papkaga o'ting:

```bash
cd kutubxonam-backend
```

**1-qadam — Ma'lumotlar bazasini ishga tushirish (Docker orqali):**

```bash
docker compose up -d
```

Bu buyruq PostgreSQL'ni fonda ishga tushiradi. Tekshirish uchun:

```bash
docker compose ps
```

`postgres` xizmati "healthy" holatida ko'rinishi kerak.

**2-qadam — Muhit sozlamalari faylini yaratish:**

```bash
cp .env.example .env
```

`.env.example` dagi standart qiymatlar docker-compose bilan mos keladi, hech narsa o'zgartirish shart emas (agar `JWT_SECRET`ni xohlasangiz o'zgartirishingiz mumkin — bu shunchaki xavfsizlik uchun tasodifiy matn).

**3-qadam — Kerakli kutubxonalarni o'rnatish:**

```bash
npm install
```

**4-qadam — Ma'lumotlar bazasi jadvallarini yaratish:**

```bash
npm run migrate
```

Muvaffaqiyatli bo'lsa "✅ Migratsiya muvaffaqiyatli yakunlandi" deb chiqadi.

**5-qadam — Serverni ishga tushirish:**

```bash
npm start
```

Terminalda `http://localhost:3000` manzili ko'rsatiladi. Brauzerda shu manzilni oching — sayt ishlaydi!

### Keyingi safar ishga tushirish

Kompyuterni o'chirib-yoqqaningizdan keyin, saytni qayta ishga tushirish uchun faqat ikkita buyruq kerak:

```bash
docker compose up -d
npm start
```

Ma'lumotlar (kitoblar, foydalanuvchilar, tarix) **hech qayerga yo'qolmaydi** — chunki ular Docker'ning doimiy xotira hajmida (volume) saqlanadi.

### Agar Docker ishlatmoqchi bo'lmasangiz

PostgreSQL'ni to'g'ridan-to'g'ri kompyuteringizga o'rnatishingiz mumkin: https://www.postgresql.org/download/
O'rnatgandan so'ng, `.env` faylidagi `DATABASE_URL`ni o'zingiz yaratgan baza ma'lumotlariga moslang, masalan:

```
DATABASE_URL=postgresql://foydalanuvchi:parol@localhost:5432/kutubxonam
```

---

## 2-QISM: Railway'ga joylashtirish (haqiqiy internet saytiga chiqarish)

**1-qadam.** https://railway.app saytiga kiring, GitHub hisobingiz bilan ro'yxatdan o'ting (bepul).

**2-qadam.** Ushbu loyihani GitHub'ga yuklang (agar hali yuklamagan bo'lsangiz):
```bash
git init
git add .
git commit -m "Kutubxonam - boshlang'ich versiya"
```
Keyin GitHub'da yangi repository yarating va shu yerga push qiling.

**3-qadam.** Railway'da "New Project" → "Deploy from GitHub repo" → repositoriyangizni tanlang.

**4-qadam.** Railway loyihangiz ichida "New" → "Database" → "Add PostgreSQL" tugmasini bosing. Railway avtomatik ravishda `DATABASE_URL` muhit o'zgaruvchisini yaratadi va ilovangizga ulaydi — buni qo'lda yozish shart emas.

**5-qadam.** Ilova sozlamalarida (Settings → Variables) qo'shimcha ravishda quyidagilarni qo'shing:
```
JWT_SECRET=juda-uzun-tasodifiy-maxfiy-matn-shu-yerga
NODE_ENV=production
```

**6-qadam.** Railway avtomatik ravishda `npm install` va `npm start` buyruqlarini bajaradi (bu `package.json` ichida sozlangan). `npm start` avtomatik ravishda ma'lumotlar bazasi jadvallarini ham yaratadi (migratsiya har safar xavfsiz qayta ishga tushadi).

**7-qadam.** Bir necha daqiqadan so'ng, Railway sizga ochiq URL beradi (masalan `kutubxonam-production.up.railway.app`) — shu havola orqali sayt butun dunyoga ochiq bo'ladi.

### Keyinchalik domen ulash

Railway loyihangizda Settings → Networking → "Custom Domain" orqali o'zingizning domeningizni (masalan `kutubxonam.uz`) ulashingiz mumkin.

---

## Loyiha tuzilishi

```
kutubxonam-backend/
├── package.json          # bog'liqliklar va npm buyruqlari
├── .env.example           # muhit sozlamalari namunasi
├── docker-compose.yml      # mahalliy PostgreSQL uchun
├── src/
│   ├── server.js          # Express server, marshrutlarni ulaydi
│   ├── db.js               # PostgreSQL ulanish pool'i
│   ├── db/
│   │   ├── schema.sql       # jadvallar tuzilishi
│   │   └── migrate.js        # jadvallarni yaratuvchi skript
│   ├── middleware/
│   │   └── auth.js          # JWT token tekshirish
│   └── routes/
│       ├── auth.js          # ro'yxatdan o'tish / kirish
│       ├── books.js         # kitoblar: qo'shish, berish, qaytarish
│       ├── students.js       # xodim uchun o'quvchi qidirish
│       └── history.js        # buyurtmalar tarixi
└── public/
    ├── index.html          # frontend sahifa
    └── app.js               # frontend JavaScript (API bilan bog'lanadi)
```

## Ma'lumotlar bazasi jadvallari

- **schools** — maktablar ro'yxati
- **users** — xodim va o'quvchilar (login, parol hash, ism, telefon, maktab)
- **books** — kitoblar (nom, muallif, muqova, holati)
- **checkouts** — har bir olish/qaytarish voqeasi (doimiy tarix)

## Muammolarni bartaraf etish

**"DATABASE_URL topilmadi" xatosi** — `.env` faylini yaratganingizga ishonch hosil qiling (`cp .env.example .env`).

**"connection refused" xatosi** — Docker konteyneri ishga tushganini tekshiring: `docker compose ps`. Agar ishlamasa: `docker compose up -d`.

**Portlar band** — agar 3000 yoki 5432 port band bo'lsa, `.env` faylida `PORT`ni yoki `docker-compose.yml`da portni o'zgartiring.
