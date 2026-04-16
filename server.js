/**
 * server.js — Librairie Mayombe Backend
 * Express + SQLite | Auth (bcrypt+JWT+cookies) | Orders | PDF | Email | Zip
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const archiver = require('archiver');
const db = require('./database');

const app = express();
const PORT = 5000;
const HOST = '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'mayombe_secret_key_2026';
const ADMIN_PASSWORD = 'TAF1-FLEMME';
const COOKIE_NAME = 'mayombe_session';
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ─── Multer (file uploads) ─────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /jpeg|jpg|png|gif|webp/.test(file.mimetype))
});

// ─── Delivery Zones ────────────────────────────────────────────────────────────
const DELIVERY_ZONES = [
  'Potopoto la gare',
  'Total vers Saint-Exupérie',
  'Présidence',
  'OSH',
  'CHU'
];

// ─── Cookie helper ─────────────────────────────────────────────────────────────
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', secure: IS_PROD });
}

// ─── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  // Accept token from: 1) Cookie, 2) Authorization header, 3) query param
  const token =
    req.cookies[COOKIE_NAME] ||
    (req.headers['authorization'] || '').replace('Bearer ', '') ||
    req.query.token ||
    '';
  if (!token) return res.status(401).json({ error: 'Authentification requise' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
  }
}

function requireAdmin(req, res, next) {
  if (req.headers['x-admin-token'] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Accès administrateur requis' });
  }
  next();
}

// ─── Email transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER || '', pass: process.env.GMAIL_PASS || '' }
});

async function sendOrderEmail(order, items) {
  if (!process.env.GMAIL_USER) return;
  const lines = items.map(i =>
    `• ${i.title} × ${i.quantity}  =  ${(i.price * i.quantity).toLocaleString('fr-FR')} FCFA`
  ).join('\n');
  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: 'moussokiexauce7@gmail.com',
      subject: `📦 Nouvelle commande #${order.id} — ${order.customer_name}`,
      html: `
        <h2>Nouvelle commande #${order.id}</h2>
        <p><b>Client :</b> ${order.customer_name}</p>
        <p><b>Email :</b> ${order.customer_email || 'N/A'}</p>
        <p><b>Tél :</b> ${order.customer_phone}</p>
        <p><b>Zone :</b> ${order.delivery_zone}</p>
        <p><b>Adresse :</b> ${order.delivery_address}</p>
        <h3>Produits</h3><pre>${lines}</pre>
        <h3>Total : ${Number(order.total).toLocaleString('fr-FR')} FCFA</h3>
        <p><i>Date : ${new Date(order.created_at).toLocaleString('fr-FR')}</i></p>
      `
    });
  } catch (e) {
    console.error('Email error:', e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// API: USER AUTH
// ══════════════════════════════════════════════════════════════════════════════

// Register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password)
    return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Le mot de passe doit avoir au moins 6 caractères' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing)
    return res.status(409).json({ error: 'Cet email est déjà utilisé', action: 'login' });

  const hash = await bcrypt.hash(password, 10);
  const result = db.prepare(
    'INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), email.toLowerCase().trim(), phone.trim(), hash);

  const token = jwt.sign(
    { id: result.lastInsertRowid, name: name.trim(), email: email.toLowerCase() },
    JWT_SECRET, { expiresIn: '7d' }
  );
  setAuthCookie(res, token);
  res.json({ token, user: { id: result.lastInsertRowid, name: name.trim(), email: email.toLowerCase(), phone: phone.trim() } });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user)
    return res.status(401).json({ error: 'Aucun compte trouvé avec cet email.', action: 'register' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid)
    return res.status(401).json({ error: 'Mot de passe incorrect.' });

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  setAuthCookie(res, token);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
});

// Logout (clears cookie)
app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

// Get profile
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, phone, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// ══════════════════════════════════════════════════════════════════════════════
// API: BOOKS
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/books', requireAuth, (req, res) => {
  const { category, search } = req.query;
  let query = 'SELECT * FROM books WHERE 1=1';
  const params = [];
  if (category && category !== 'all') { query += ' AND category = ?'; params.push(category); }
  if (search) {
    query += ' AND (title LIKE ? OR author LIKE ? OR description LIKE ?)';
    const s = `%${search}%`; params.push(s, s, s);
  }
  query += ' ORDER BY created_at DESC';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/books/categories', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT DISTINCT category FROM books ORDER BY category').all().map(c => c.category));
});

app.get('/api/books/:id', requireAuth, (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livre non trouvé' });
  const reviews = db.prepare('SELECT * FROM reviews WHERE book_id = ? ORDER BY created_at DESC').all(req.params.id);
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  res.json({ ...book, reviews, avg_rating: avg });
});

// Admin: list all books (no user auth needed)
app.get('/api/admin/books', requireAdmin, (req, res) => {
  const { category, search } = req.query;
  let query = 'SELECT * FROM books WHERE 1=1';
  const params = [];
  if (category && category !== 'all') { query += ' AND category = ?'; params.push(category); }
  if (search) {
    query += ' AND (title LIKE ? OR author LIKE ? OR description LIKE ?)';
    const s = `%${search}%`; params.push(s, s, s);
  }
  query += ' ORDER BY created_at DESC';
  res.json(db.prepare(query).all(...params));
});

// Admin: list all categories
app.get('/api/admin/books/categories', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT DISTINCT category FROM books ORDER BY category').all().map(c => c.category));
});

// Admin: get one book with reviews
app.get('/api/admin/books/:id', requireAdmin, (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livre non trouvé' });
  const reviews = db.prepare('SELECT * FROM reviews WHERE book_id = ? ORDER BY created_at DESC').all(req.params.id);
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  res.json({ ...book, reviews, avg_rating: avg });
});

// Admin: add book
app.post('/api/admin/books', requireAdmin, upload.single('image'), (req, res) => {
  const { title, author, description, price, category, stock } = req.body;
  if (!title || !author || !price || !category)
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  const result = db.prepare(
    'INSERT INTO books (title, author, description, price, category, image_url, stock) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(title, author, description || '', parseFloat(price), category, image_url, parseInt(stock) || 10);
  res.json({ success: true, id: result.lastInsertRowid });
});

// Admin: edit book
app.put('/api/admin/books/:id', requireAdmin, upload.single('image'), (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livre non trouvé' });
  const { title, author, description, price, category, stock } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : book.image_url;
  db.prepare(
    'UPDATE books SET title=?, author=?, description=?, price=?, category=?, image_url=?, stock=? WHERE id=?'
  ).run(title || book.title, author || book.author, description ?? book.description,
    parseFloat(price) || book.price, category || book.category, image_url,
    parseInt(stock) || book.stock, req.params.id);
  res.json({ success: true });
});

// Admin: delete book
app.delete('/api/admin/books/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// API: ORDERS
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/delivery-zones', (req, res) => res.json(DELIVERY_ZONES));

app.post('/api/orders', requireAuth, async (req, res) => {
  const { customer_name, customer_email, customer_phone, delivery_zone, delivery_address, items } = req.body;
  if (!DELIVERY_ZONES.includes(delivery_zone)) {
    return res.status(400).json({
      error: 'Zone non desservie',
      message: `Désolé, la livraison n'est disponible que dans : ${DELIVERY_ZONES.join(', ')}`
    });
  }
  if (!items?.length) return res.status(400).json({ error: 'Panier vide' });
  if (!customer_name || !customer_phone || !delivery_address)
    return res.status(400).json({ error: 'Informations incomplètes' });

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const result = db.prepare(
    'INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, delivery_zone, delivery_address, items, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, customer_name, customer_email || '', customer_phone, delivery_zone, delivery_address, JSON.stringify(items), total);

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
  await sendOrderEmail(order, items);
  res.json({ success: true, order_id: order.id, total, cancellable_until: Date.now() + 5 * 60 * 1000 });
});

// User: my orders
app.get('/api/orders/mine', requireAuth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(orders);
});

// Order tracking (by id, user must own it)
app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  if (order.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });
  res.json({ ...order, items: JSON.parse(order.items || '[]') });
});

// Cancel order
app.post('/api/orders/:id/cancel', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  if (order.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });
  if (order.status !== 'pending') return res.status(400).json({ error: 'Commande déjà traitée' });
  if (Date.now() - new Date(order.created_at).getTime() > 5 * 60 * 1000)
    return res.status(400).json({ error: 'Le délai d\'annulation de 5 minutes est dépassé' });
  db.prepare('UPDATE orders SET status=?, cancelled_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?').run('cancelled', req.params.id);
  res.json({ success: true });
});

// PDF receipt — accepts token via cookie, header, or query param
app.get('/api/orders/:id/receipt', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Introuvable' });
  if (order.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });
  const items = JSON.parse(order.items);
  const doc = new PDFDocument({ margin: 60, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="recu-${order.id}.pdf"`);
  doc.pipe(res);

  doc.fontSize(26).fillColor('#c0392b').font('Helvetica-Bold').text('LIBRAIRIE MAYOMBE', { align: 'center' });
  doc.fontSize(11).fillColor('#777').font('Helvetica').text('Votre librairie en ligne de confiance — Pointe-Noire', { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#e74c3c').lineWidth(2).stroke();
  doc.moveDown(0.5);

  doc.fontSize(18).fillColor('#333').font('Helvetica-Bold').text(`Reçu de Commande #${order.id}`);
  doc.fontSize(10).fillColor('#666').font('Helvetica').text(`Date : ${new Date(order.created_at).toLocaleString('fr-FR')}`);
  doc.moveDown(0.5);

  doc.fontSize(13).fillColor('#c0392b').font('Helvetica-Bold').text('Informations Client');
  doc.fontSize(11).fillColor('#333').font('Helvetica');
  doc.text(`Nom     : ${order.customer_name}`);
  doc.text(`Email   : ${order.customer_email || 'N/A'}`);
  doc.text(`Tél     : ${order.customer_phone}`);
  doc.text(`Zone    : ${order.delivery_zone}`);
  doc.text(`Adresse : ${order.delivery_address}`);
  doc.moveDown(0.5);

  doc.fontSize(13).fillColor('#c0392b').font('Helvetica-Bold').text('Produits commandés');
  doc.fontSize(11).fillColor('#333').font('Helvetica');
  for (const item of items) {
    doc.text(`• ${item.title}  ×${item.quantity}  →  ${(item.price * item.quantity).toLocaleString('fr-FR')} FCFA`);
  }
  doc.moveDown(0.5);
  doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#e74c3c').lineWidth(1).stroke();
  doc.moveDown(0.3);
  doc.fontSize(15).fillColor('#c0392b').font('Helvetica-Bold').text(`TOTAL : ${Number(order.total).toLocaleString('fr-FR')} FCFA`, { align: 'right' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#888').font('Helvetica').text('Paiement en espèces à la livraison. Merci pour votre confiance !', { align: 'center' });
  doc.end();
});

// Admin: all orders
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all());
});

// Admin: update order status
app.put('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { status, tracking_note } = req.body;
  db.prepare('UPDATE orders SET status=?, tracking_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(status, tracking_note || null, req.params.id);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// API: REVIEWS
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/books/:id/reviews', requireAuth, (req, res) => {
  const { rating, comment } = req.body;
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livre non trouvé' });
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Note entre 1 et 5 requise' });
  db.prepare('INSERT INTO reviews (book_id, user_id, customer_name, rating, comment) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, req.user.id, req.user.name, parseInt(rating), comment || '');
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// API: ADS
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/ads', (req, res) => {
  res.json(db.prepare('SELECT * FROM ads WHERE active=1 ORDER BY created_at DESC').all());
});
app.post('/api/admin/ads', requireAdmin, upload.single('image'), (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Titre et contenu requis' });
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  db.prepare('INSERT INTO ads (title, content, image_url) VALUES (?, ?, ?)').run(title, content, image_url);
  res.json({ success: true });
});
app.delete('/api/admin/ads/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM ads WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// API: ADMIN — USERS LIST
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, name, email, phone, created_at FROM users ORDER BY created_at DESC'
  ).all();
  // Attach order count per user
  const withStats = users.map(u => {
    const orderCount = db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id=?").get(u.id).c;
    const totalSpent = db.prepare("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE user_id=? AND status != 'cancelled'").get(u.id).s;
    return { ...u, order_count: orderCount, total_spent: totalSpent };
  });
  res.json(withStats);
});

// ══════════════════════════════════════════════════════════════════════════════
// API: DOWNLOAD SOURCE CODE (ZIP) — Admin only
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/download-source', requireAdmin, (req, res) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="librairie-mayombe-source.zip"');
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  const ignore = ['node_modules', 'librairie.db', '.git', 'public/uploads'];
  archive.glob('**/*', {
    cwd: __dirname,
    ignore: ignore.map(i => `${i}/**`).concat(ignore)
  });
  archive.finalize();
});

// ── Admin stats ────────────────────────────────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const books = db.prepare('SELECT COUNT(*) as c FROM books').get().c;
  const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const orders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != 'cancelled'").get().s;
  const pending = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='pending'").get().c;
  res.json({ books, users, orders, revenue, pending });
});

// ── Catch-all SPA ─────────────────────────────────────────────────────────────
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`✅ Librairie Mayombe → http://${HOST}:${PORT}`);
});
