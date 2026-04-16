/**
 * database.js — SQLite setup for Librairie Mayombe
 * Tables: users, books, orders, reviews, ads
 */
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'librairie.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    stock INTEGER DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_zone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    tracking_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    cancelled_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    user_id INTEGER,
    customer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ─── Seed books ───────────────────────────────────────────────────────────────
const count = db.prepare('SELECT COUNT(*) as c FROM books').get();
if (count.c === 0) {
  const insert = db.prepare(`
    INSERT INTO books (title, author, description, price, category, image_url, stock)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const books = [
    ['Le Petit Prince', 'Antoine de Saint-Exupéry', 'Un conte poétique et philosophique sur la solitude, l\'amitié et la quête du sens dans un monde adulte qui oublie de regarder les étoiles.', 3500, 'Littérature', null, 15],
    ['L\'Alchimiste', 'Paulo Coelho', 'L\'épopée initiatique d\'un jeune berger andalou qui traverse le désert africain pour trouver un trésor caché, et découvre que la vraie richesse est dans le voyage intérieur.', 4000, 'Développement personnel', null, 12],
    ['Germinal', 'Émile Zola', 'Plongée au cœur des mines du Nord de la France au XIXe siècle : la misère des mineurs, l\'injustice sociale et l\'éveil de la conscience ouvrière dans un récit puissant et saisissant.', 3000, 'Classiques', null, 8],
    ['Sapiens', 'Yuval Noah Harari', 'Une brève histoire de l\'humanité qui retrace 70 000 ans d\'évolution humaine, des premières communautés de chasseurs-cueilleurs à l\'ère de l\'intelligence artificielle.', 6000, 'Histoire', null, 10],
    ['1984', 'George Orwell', 'Dans une société totalitaire où Big Brother surveille chaque citoyen, Winston Smith ose résister. Un roman dystopique visionnaire qui résonne encore dans notre époque numérique.', 3500, 'Science-Fiction', null, 7],
    ['Les Misérables', 'Victor Hugo', 'Jean Valjean, ancien bagnard, tente de se racheter dans une France du XIXe siècle déchirée par les inégalités. Un monument de la littérature mondiale, entre amour, justice et rédemption.', 5000, 'Classiques', null, 9],
    ['Atomic Habits', 'James Clear', 'La méthode scientifique pour construire de bonnes habitudes et briser les mauvaises, en s\'appuyant sur de petits changements quotidiens qui produisent des résultats extraordinaires.', 5500, 'Développement personnel', null, 11],
    ['La Peste', 'Albert Camus', 'La ville d\'Oran est ravagée par la peste. Le docteur Rieux et ses compagnons luttent contre le fléau. Une allégorie de l\'absurde et de la solidarité humaine face à l\'adversité.', 3200, 'Littérature', null, 6],
    ['Dune', 'Frank Herbert', 'Sur la planète désertique Arrakis, Paul Atreides devient le messie d\'un peuple opprimé dans une saga épique mêlant politique, écologie et mysticisme.', 5000, 'Science-Fiction', null, 8],
    ['L\'Art de la Guerre', 'Sun Tzu', 'Ce traité militaire chinois vieux de 2 500 ans transcende le champ de bataille pour offrir une philosophie universelle de la stratégie, de la diplomatie et du leadership.', 2500, 'Histoire', null, 14],
  ];
  for (const b of books) insert.run(...b);
}

module.exports = db;
