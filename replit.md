# Librairie Mayombe — E-Commerce Bookstore

## Overview
A full e-commerce bookstore for Pointe-Noire, Congo, with user accounts, admin dashboard, order tracking, PDF receipts, and delivery zone enforcement.

## Tech Stack
- **Backend**: Node.js + Express
- **Database**: SQLite via better-sqlite3
- **Auth**: JWT + bcryptjs (password hashing)
- **PDF**: PDFKit
- **Email**: Nodemailer (optional, Gmail)
- **File uploads**: Multer
- **Zip export**: Archiver
- **Frontend**: Vanilla HTML/CSS/JS (SPA)

## Architecture
- `server.js` — Express API server (auth, books, orders, reviews, ads, PDF, zip)
- `database.js` — SQLite schema (users, books, orders, reviews, ads) + seed data
- `public/index.html` — Single-page app with auth wall, client app, and admin app
- `public/css/style.css` — Professional warm/vibrant design (Amazon/Fnac inspired)
- `public/js/app.js` — All frontend logic
- `public/uploads/` — Uploaded book cover images
- `librairie.db` — SQLite database (auto-created)

## User Flows

### Client Flow
1. Register/login with email + password (bcrypt hashed)
2. Browse catalog by category or search
3. Add books to cart, adjust quantities
4. Checkout: select delivery zone (restricted to 5 zones), fill address
5. Order confirmed → 5-minute cancellation window → PDF receipt download
6. "Mes commandes" page → real-time order tracking (4 status steps)

### Admin Flow (password: TAF1-FLEMME)
- Click "Espace administrateur" on auth wall
- Dashboard: stats (books, users, orders, revenue, pending)
- Books: add/edit/delete with image upload
- Orders: view all, filter by status, update status + tracking note
- Ads: publish/delete banners visible to clients
- Download full source code as ZIP

## Delivery Zones (only these 5 are valid)
- Potopoto la gare
- Total vers Saint-Exupérie
- Présidence
- OSH
- CHU

## Email Notifications (optional)
Set env vars to enable automatic email to moussokiexauce7@gmail.com:
- `GMAIL_USER` — your Gmail address
- `GMAIL_PASS` — Gmail app password

## Running
```
node server.js
```
Runs on port 5000.
