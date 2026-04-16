/* ══════════════════════════════════════════════
   LIBRAIRIE MAYOMBE — Frontend Application
   Auth | Catalogue | Cart | Orders | Admin
══════════════════════════════════════════════ */

// ─── State ────────────────────────────────────────────────────────────────────
let currentUser = null;
let authToken = localStorage.getItem('mayombe_token') || null;
let cart = JSON.parse(localStorage.getItem('mayombe_cart') || '[]');
let isAdmin = false;
let currentCategory = 'all';
let currentOrderId = null;
let cancelTimer = null;
const BRAND_LOGO = '/assets/magma-logo.jpeg';

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initStars();
  if (authToken) {
    verifyToken();
  } else {
    showAuthWall();
  }
  loadDeliveryZones();
});

// ─── Token Verification ───────────────────────────────────────────────────────
async function verifyToken() {
  try {
    const user = await api('/api/auth/me', 'GET');
    currentUser = user;
    enterApp();
  } catch {
    authToken = null;
    localStorage.removeItem('mayombe_token');
    showAuthWall();
  }
}

function showAuthWall() {
  document.getElementById('authWall').classList.remove('hidden');
  document.getElementById('clientApp').classList.add('hidden');
  document.getElementById('adminApp').classList.add('hidden');
  isAdmin = false;
}

function enterApp() {
  document.getElementById('authWall').classList.add('hidden');
  document.getElementById('clientApp').classList.remove('hidden');
  document.getElementById('adminApp').classList.add('hidden');
  isAdmin = false;
  prefillCheckout();
  updateCartCount();
  showView('home');
  if (currentUser) {
    const initials = currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userNameDisplay').textContent = currentUser.name.split(' ')[0];
    document.getElementById('dropdownHeader').textContent = `${currentUser.name} · ${currentUser.email}`;
  }
}

// ─── Auth — Login ─────────────────────────────────────────────────────────────
async function submitLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Connexion…';
  try {
    const data = await api('/api/auth/login', 'POST', {
      email: document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPassword').value
    });
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('mayombe_token', authToken);
    enterApp();
  } catch (err) {
    // Si l'email n'existe pas → proposer de créer un compte
    if (err.action === 'register') {
      errEl.innerHTML = `${err.message} <a href="#" class="auth-action-link" onclick="switchAuthTab('register');return false">Créer un compte →</a>`;
    } else {
      errEl.textContent = err.message;
    }
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Se connecter';
  }
}

// ─── Auth — Register ──────────────────────────────────────────────────────────
async function submitRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('registerBtn');
  const errEl = document.getElementById('registerError');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Création…';
  try {
    const data = await api('/api/auth/register', 'POST', {
      name: document.getElementById('regName').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      phone: document.getElementById('regPhone').value.trim(),
      password: document.getElementById('regPassword').value
    });
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('mayombe_token', authToken);
    toast('Bienvenue ' + data.user.name + ' !');
    enterApp();
  } catch (err) {
    // Si l'email est déjà utilisé → proposer de se connecter
    if (err.action === 'login') {
      errEl.innerHTML = `${err.message} <a href="#" class="auth-action-link" onclick="switchAuthTab('login');return false">Se connecter →</a>`;
    } else {
      errEl.textContent = err.message;
    }
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Créer mon compte';
  }
}

function switchAuthTab(tab) {
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('loginError').classList.add('hidden');
  document.getElementById('registerError').classList.add('hidden');
}

// Password strength meter
document.addEventListener('DOMContentLoaded', () => {
  const pw = document.getElementById('regPassword');
  const bar = document.getElementById('pwStrength');
  if (!pw) return;
  pw.addEventListener('input', () => {
    const v = pw.value;
    let score = 0;
    if (v.length >= 6) score++;
    if (v.length >= 10) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#27ae60'];
    bar.style.width = (score * 20) + '%';
    bar.style.background = colors[score - 1] || '#eee';
  });
});

async function logout() {
  // Appel API pour effacer le cookie côté serveur
  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
  authToken = null;
  currentUser = null;
  localStorage.removeItem('mayombe_token');
  cart = [];
  saveCart();
  showAuthWall();
  closeDropdown();
  toast('Vous avez été déconnecté', 'info');
}

// ─── Admin Auth ───────────────────────────────────────────────────────────────
function showAdminLogin() {
  document.getElementById('adminPwd').value = '';
  document.getElementById('adminLoginError').classList.add('hidden');
  openModal('modalAdminLogin');
  setTimeout(() => document.getElementById('adminPwd').focus(), 100);
}

function doAdminLogin() {
  const pwd = document.getElementById('adminPwd').value;
  const errEl = document.getElementById('adminLoginError');
  if (pwd === 'TAF1-FLEMME') {
    isAdmin = true;
    closeModal('modalAdminLogin');
    showAuthWall();
    document.getElementById('authWall').classList.add('hidden');
    document.getElementById('clientApp').classList.add('hidden');
    document.getElementById('adminApp').classList.remove('hidden');
    switchAdminTab('dashboard');
  } else {
    errEl.textContent = 'Mot de passe incorrect.';
    errEl.classList.remove('hidden');
    document.getElementById('adminPwd').value = '';
  }
}

function adminLogout() {
  isAdmin = false;
  document.getElementById('adminApp').classList.add('hidden');
  showAuthWall();
}

// ─── View Navigation ──────────────────────────────────────────────────────────
function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.snav').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${view}`)?.classList.add('active');
  document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
  closeDropdown();

  const loaders = {
    home: loadHome,
    catalogue: () => loadCatalogue(),
    cart: renderCart,
    checkout: loadCheckout,
    orders: loadMyOrders,
  };
  if (loaders[view]) loaders[view]();
  window.scrollTo(0, 0);
}

// ─── User Menu Dropdown ───────────────────────────────────────────────────────
function toggleUserMenu() {
  const dd = document.getElementById('userDropdown');
  dd.classList.toggle('hidden');
}
function closeDropdown() {
  document.getElementById('userDropdown')?.classList.add('hidden');
}
document.addEventListener('click', e => {
  const pill = e.target.closest('.user-pill');
  const dd = document.getElementById('userDropdown');
  if (!pill && dd) dd.classList.add('hidden');
});

// ─── HOME ─────────────────────────────────────────────────────────────────────
async function loadHome() {
  await Promise.all([loadHomeBooks(), loadHomeCats(), loadAds()]);
}

async function loadHomeBooks() {
  const books = await api('/api/books');
  const container = document.getElementById('homeBooks');
  container.innerHTML = books.slice(0, 10).map(b => bookCardHTML(b)).join('');
}

async function loadHomeCats() {
  const cats = await api('/api/books/categories');
  document.getElementById('homeCatChips').innerHTML =
    cats.map(c => `<button class="cat-chip" onclick="filterByCat('${esc(c)}')">${c}</button>`).join('');
}

async function loadAds() {
  const ads = await api('/api/ads');
  const strip = document.getElementById('adsStrip');
  if (!ads.length) { strip.style.display = 'none'; return; }
  strip.style.display = 'flex';
  strip.innerHTML = ads.map(a => `
    <div class="ad-chip">
      <h4>${a.title}</h4>
      <p>${a.content}</p>
    </div>`).join('');
}

// ─── CATALOGUE ────────────────────────────────────────────────────────────────
async function loadCatalogue(cat) {
  if (cat !== undefined) currentCategory = cat;

  const cats = await api('/api/books/categories');
  const sidebar = document.getElementById('sidebarCats');
  sidebar.innerHTML = `<li class="${currentCategory === 'all' ? 'active' : ''}" onclick="filterByCat('all')">Tous les livres</li>` +
    cats.map(c => `<li class="${currentCategory === c ? 'active' : ''}" onclick="filterByCat('${esc(c)}')">${c}</li>`).join('');

  const params = new URLSearchParams();
  if (currentCategory !== 'all') params.append('category', currentCategory);
  const search = document.getElementById('globalSearch')?.value?.trim();
  if (search) params.append('search', search);

  const books = await api(`/api/books?${params}`);
  document.getElementById('catTitle').textContent = currentCategory === 'all' ? 'Tous les livres' : currentCategory;
  document.getElementById('catCount').textContent = `${books.length} livre${books.length !== 1 ? 's' : ''}`;
  document.getElementById('catalogueGrid').innerHTML = books.length ? books.map(b => bookCardHTML(b)).join('') : '';
  document.getElementById('catalogueEmpty').classList.toggle('hidden', books.length > 0);
}

function filterByCat(cat) {
  currentCategory = cat;
  showView('catalogue');
}

function handleSearch() {
  const active = document.querySelector('.view.active');
  if (active?.id === 'view-catalogue') loadCatalogue();
  else showView('catalogue');
}

// ─── BOOK CARDS ───────────────────────────────────────────────────────────────
function bookCardHTML(b) {
  const stars = b.avg_rating
    ? `${'★'.repeat(Math.round(b.avg_rating))}${'☆'.repeat(5 - Math.round(b.avg_rating))} ${b.avg_rating}`
    : '';
  return `
    <div class="bcard" onclick="openBook(${b.id})">
      <div class="bcard-cover">
        ${b.image_url
          ? `<img src="${b.image_url}" alt="${b.title}" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><div class="bcard-cover-fb" style="display:none"><img src="${BRAND_LOGO}" alt="Magma" /></div>`
          : `<div class="bcard-cover-fb"><img src="${BRAND_LOGO}" alt="Magma" /></div>`}
        <span class="bcard-badge">${b.category}</span>
      </div>
      <div class="bcard-body">
        <div class="bcard-title">${b.title}</div>
        <div class="bcard-author">par ${b.author}</div>
        ${stars ? `<div class="bcard-rating">⭐ ${stars}</div>` : ''}
        <div class="bcard-footer">
          <span class="bcard-price">${fmtPrice(b.price)}</span>
          <button class="btn-cart-sm" onclick="event.stopPropagation();addToCart(${b.id},'${esc(b.title)}','${esc(b.author)}',${b.price},'${b.image_url || ''}')">+ Panier</button>
        </div>
      </div>
    </div>`;
}

// ─── BOOK DETAIL ──────────────────────────────────────────────────────────────
async function openBook(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-book').classList.add('active');
  document.getElementById('bookDetailWrap').innerHTML = '<div style="padding:3rem;text-align:center;color:#999">Chargement…</div>';

  const b = await api(`/api/books/${id}`);
  const avgStars = b.avg_rating
    ? `${'★'.repeat(Math.round(b.avg_rating))}${'☆'.repeat(5 - Math.round(b.avg_rating))} ${b.avg_rating}/5 (${b.reviews.length} avis)`
    : 'Aucun avis';

  const reviewsHTML = b.reviews.length
    ? b.reviews.map(r => `
        <div class="rv-card">
          <div class="rv-head">
            <span class="rv-name">${r.customer_name}</span>
            <span class="rv-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            <span class="rv-date">${fmtDate(r.created_at)}</span>
          </div>
          ${r.comment ? `<p class="rv-text">${r.comment}</p>` : ''}
        </div>`).join('')
    : `<p class="no-reviews">Pas encore d'avis. Soyez le premier à laisser un avis !</p>`;

  document.getElementById('bookDetailWrap').innerHTML = `
    <button class="btn-back" onclick="history.back()">← Retour</button>
    <div class="bdetail">
      <div class="bdetail-cover">
        ${b.image_url ? `<img src="${b.image_url}" alt="${b.title}" />` : `<img class="fallback-logo" src="${BRAND_LOGO}" alt="Magma" />`}
      </div>
      <div class="bdetail-info">
        <span class="bdetail-cat">${b.category}</span>
        <h1>${b.title}</h1>
        <p class="bdetail-author">par ${b.author}</p>
        <div class="bdetail-rating">⭐ ${avgStars}</div>
        <p class="bdetail-desc">${b.description || 'Aucune description disponible.'}</p>
        <div class="bdetail-price">${fmtPrice(b.price)}</div>
        <div class="bdetail-actions">
          <button class="btn-primary" onclick="addToCart(${b.id},'${esc(b.title)}','${esc(b.author)}',${b.price},'${b.image_url || ''}'); showView('cart')">
            🛒 Ajouter au panier
          </button>
          <button class="btn-outline" onclick="openReviewModal(${b.id})">⭐ Donner un avis</button>
        </div>
      </div>
    </div>
    <div class="reviews-card">
      <h3>Avis clients</h3>
      <div id="bookReviews">${reviewsHTML}</div>
    </div>`;
  window.scrollTo(0, 0);
}

// ─── CART ─────────────────────────────────────────────────────────────────────
function addToCart(id, title, author, price, image_url) {
  const existing = cart.find(i => i.id === id);
  if (existing) existing.quantity++;
  else cart.push({ id, title, author, price, image_url, quantity: 1 });
  saveCart();
  toast(`"${title}" ajouté au panier`);
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart(); renderCart();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.quantity = Math.max(1, item.quantity + delta);
  saveCart(); renderCart();
}

function saveCart() {
  localStorage.setItem('mayombe_cart', JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const n = cart.reduce((s, i) => s + i.quantity, 0);
  const el = document.getElementById('cartCount');
  if (el) el.textContent = n;
}

function renderCart() {
  const items = document.getElementById('cartItems');
  const aside = document.getElementById('cartAside');
  const empty = document.getElementById('cartEmpty');
  const layout = document.getElementById('cartLayout');

  if (!cart.length) {
    layout.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  layout.classList.remove('hidden');
  empty.classList.add('hidden');

  items.innerHTML = cart.map(i => `
    <div class="cart-item">
      <div class="ci-img">
        ${i.image_url ? `<img src="${i.image_url}" alt="${i.title}" />` : `<img class="fallback-logo" src="${BRAND_LOGO}" alt="Magma" />`}
      </div>
      <div class="ci-info">
        <div class="ci-title">${i.title}</div>
        <div class="ci-author">par ${i.author}</div>
        <div class="ci-price">${fmtPrice(i.price * i.quantity)}</div>
        <div class="ci-controls">
          <button class="qty-btn" onclick="changeQty(${i.id},-1)">−</button>
          <span class="qty-num">${i.quantity}</span>
          <button class="qty-btn" onclick="changeQty(${i.id},+1)">+</button>
          <button class="btn-rm" onclick="removeFromCart(${i.id})" title="Retirer">🗑</button>
        </div>
      </div>
    </div>`).join('');

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  aside.innerHTML = `
    <div class="cart-aside-box">
      <h3>Résumé</h3>
      ${cart.map(i => `<div class="cart-line"><span>${i.title} ×${i.quantity}</span><span>${fmtPrice(i.price * i.quantity)}</span></div>`).join('')}
      <div class="cart-line total"><span>Total</span><span>${fmtPrice(subtotal)}</span></div>
      <div style="margin-top:1rem">
        <button class="btn-primary full" onclick="showView('checkout')">Commander →</button>
      </div>
      <div style="margin-top:0.6rem;text-align:center">
        <button class="btn-link" onclick="cart=[];saveCart();renderCart()">Vider le panier</button>
      </div>
    </div>`;
}

// ─── CHECKOUT ─────────────────────────────────────────────────────────────────
async function loadDeliveryZones() {
  const zones = await api('/api/delivery-zones');
  const sel = document.getElementById('ckZone');
  if (!sel) return;
  zones.forEach(z => {
    const o = document.createElement('option');
    o.value = z; o.textContent = z;
    sel.appendChild(o);
  });
}

function prefillCheckout() {
  if (!currentUser) return;
  const name = document.getElementById('ckName');
  const email = document.getElementById('ckEmail');
  const phone = document.getElementById('ckPhone');
  if (name) name.value = currentUser.name;
  if (email) email.value = currentUser.email;
  if (phone) phone.value = currentUser.phone;
}

function loadCheckout() {
  if (!cart.length) { showView('cart'); return; }
  prefillCheckout();
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  document.getElementById('checkoutSummary').innerHTML = `
    <div class="checkout-summary-box">
      <h3>Votre commande</h3>
      ${cart.map(i => `<div class="cs-line"><span>${i.title} ×${i.quantity}</span><span>${fmtPrice(i.price * i.quantity)}</span></div>`).join('')}
      <div class="cs-total"><span>Total</span><span>${fmtPrice(subtotal)}</span></div>
      <p style="font-size:0.8rem;color:#999;margin-top:0.7rem">💵 Paiement en espèces à la livraison</p>
    </div>`;
}

function onZoneChange() {
  const zone = document.getElementById('ckZone').value;
  const alert = document.getElementById('zoneAlert');
  if (!zone) { alert.classList.add('hidden'); return; }
  alert.className = 'zone-alert ok';
  alert.textContent = '✅ Zone desservie ! Nous pouvons vous livrer.';
  alert.classList.remove('hidden');
}

async function submitOrder(e) {
  e.preventDefault();
  if (!cart.length) { toast('Votre panier est vide', 'error'); return; }
  const zone = document.getElementById('ckZone').value;
  if (!zone) { toast('Choisissez une zone de livraison', 'error'); return; }

  const btn = document.getElementById('ckSubmit');
  btn.disabled = true; btn.textContent = 'Envoi en cours…';
  try {
    const result = await api('/api/orders', 'POST', {
      customer_name: document.getElementById('ckName').value.trim(),
      customer_email: document.getElementById('ckEmail').value.trim(),
      customer_phone: document.getElementById('ckPhone').value.trim(),
      delivery_zone: zone,
      delivery_address: document.getElementById('ckAddress').value.trim(),
      items: cart.map(i => ({ id: i.id, title: i.title, price: i.price, quantity: i.quantity }))
    });
    currentOrderId = result.order_id;
    cart = []; saveCart();
    showConfirmation(result);
    showView('confirmation');
  } catch (err) {
    toast(err.message || 'Erreur lors de la commande', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Confirmer la commande';
  }
}

// ─── CONFIRMATION ─────────────────────────────────────────────────────────────
function showConfirmation(result) {
  document.getElementById('confirmInfo').textContent =
    `Commande #${result.order_id} validée ! Total : ${fmtPrice(result.total)}. Paiement en espèces à la livraison.`;

  const dlBtn = document.getElementById('dlReceiptBtn');
  dlBtn.onclick = () => window.open(`/api/orders/${result.order_id}/receipt?token=${authToken}`, '_blank');

  const cancelBtn = document.getElementById('cancelOrderBtn');
  const timerEl = document.getElementById('timerBox');
  if (cancelTimer) clearInterval(cancelTimer);

  let remaining = 300;
  update();
  cancelTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(cancelTimer);
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Délai expiré';
      timerEl.textContent = '⏰ Délai d\'annulation expiré. Votre commande est en cours de traitement.';
    } else update();
  }, 1000);

  function update() {
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    timerEl.textContent = `⏳ Annulation possible pendant encore : ${m}:${s}`;
  }

  cancelBtn.disabled = false;
  cancelBtn.textContent = 'Annuler la commande';
  cancelBtn.onclick = async () => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette commande ?')) return;
    try {
      await api(`/api/orders/${result.order_id}/cancel`, 'POST');
      clearInterval(cancelTimer);
      toast('Commande annulée avec succès', 'info');
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Annulée';
      timerEl.textContent = '✅ Votre commande a été annulée.';
    } catch (err) {
      toast(err.message || 'Impossible d\'annuler', 'error');
    }
  };
}

// ─── MY ORDERS ────────────────────────────────────────────────────────────────
async function loadMyOrders() {
  const orders = await api('/api/orders/mine');
  const container = document.getElementById('ordersList');
  if (!orders.length) {
    container.innerHTML = `<div class="cart-empty"><img class="empty-logo" src="${BRAND_LOGO}" alt="Magma" /><h3>Aucune commande</h3><p>Vous n'avez pas encore passé de commande.</p><button class="btn-primary" onclick="showView('catalogue')">Découvrir les livres</button></div>`;
    return;
  }
  container.innerHTML = orders.map(o => {
    const items = JSON.parse(o.items || '[]');
    return `
    <div class="order-row">
      <div>
        <div class="or-id">Commande #${o.id}</div>
        <div style="font-size:.78rem;color:#999">${fmtDate(o.created_at)}</div>
      </div>
      <div class="or-info">
        <div class="or-items">${items.map(i => `${i.title} ×${i.quantity}`).join(' · ')}</div>
        <div style="margin-top:4px">${statusBadge(o.status)}</div>
      </div>
      <div class="or-total">${fmtPrice(o.total)}</div>
      <div class="or-actions">
        <button class="btn-icon-sm" onclick="openTracking(${o.id})">🔍 Suivi</button>
        <button class="btn-icon-sm" onclick="window.open('/api/orders/${o.id}/receipt?token=${authToken}','_blank')">⬇ PDF</button>
      </div>
    </div>`;
  }).join('');
}

// ─── ORDER TRACKING ───────────────────────────────────────────────────────────
async function openTracking(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-tracking').classList.add('active');
  document.getElementById('trackingContent').innerHTML = '<p style="color:#999;padding:2rem">Chargement…</p>';

  const o = await api(`/api/orders/${id}`);
  const items = o.items;
  const steps = [
    { key: 'pending', label: 'Commande reçue', icon: '📋' },
    { key: 'confirmed', label: 'Commande confirmée', icon: '✅' },
    { key: 'shipping', label: 'En cours de livraison', icon: '🚴' },
    { key: 'delivered', label: 'Livrée', icon: '🏠' },
  ];
  const order_idx = o.status === 'cancelled' ? -1 : steps.findIndex(s => s.key === o.status);

  const stepsHTML = o.status === 'cancelled'
    ? `<div class="zone-alert err" style="border-radius:8px">❌ Cette commande a été annulée.</div>`
    : steps.map((s, i) => {
        const cls = i < order_idx ? 'done' : i === order_idx ? 'current' : '';
        const check = i < order_idx ? '✓' : i === order_idx ? s.icon : '';
        return `
          <div class="tstep ${cls}">
            <div class="tstep-dot">${check}</div>
            <div class="tstep-label">${s.label}</div>
          </div>`;
      }).join('');

  document.getElementById('trackingContent').innerHTML = `
    <div class="tracking-card">
      <h2>Suivi de commande #${o.id}</h2>
      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.2rem">
        <span>${statusBadge(o.status)}</span>
        <span style="font-size:.88rem;color:#666">Passée le ${fmtDate(o.created_at)}</span>
      </div>
      <div class="tracking-steps">${stepsHTML}</div>
      ${o.tracking_note ? `<div class="delivery-notice" style="margin-top:1rem">📝 ${o.tracking_note}</div>` : ''}
    </div>
    <div class="tracking-card">
      <h3 style="font-family:'Playfair Display',serif;color:var(--red);margin-bottom:.8rem">Détails de la commande</h3>
      <div style="font-size:.9rem;color:#555;line-height:1.8">
        <div><strong>Client :</strong> ${o.customer_name}</div>
        <div><strong>Tél :</strong> ${o.customer_phone}</div>
        <div><strong>Zone :</strong> ${o.delivery_zone}</div>
        <div><strong>Adresse :</strong> ${o.delivery_address}</div>
      </div>
      <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
        ${items.map(i => `<div style="display:flex;justify-content:space-between;padding:.3rem 0;font-size:.9rem"><span>${i.title} ×${i.quantity}</span><span>${fmtPrice(i.price * i.quantity)}</span></div>`).join('')}
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1rem;border-top:1px solid var(--border);padding-top:.6rem;margin-top:.4rem;color:var(--red)">
          <span>Total</span><span>${fmtPrice(o.total)}</span>
        </div>
      </div>
      <div style="margin-top:1rem;display:flex;gap:.7rem;flex-wrap:wrap">
        <button class="btn-primary sm" onclick="window.open('/api/orders/${o.id}/receipt?token=${authToken}','_blank')">⬇ Reçu PDF</button>
        ${o.status === 'pending'
          ? `<button class="btn-outline-danger" onclick="cancelOrderFromTracking(${o.id})" id="trackCancelBtn">Annuler</button>`
          : ''}
      </div>
    </div>`;
}

async function cancelOrderFromTracking(id) {
  if (!confirm('Annuler cette commande ?')) return;
  try {
    await api(`/api/orders/${id}/cancel`, 'POST');
    toast('Commande annulée', 'info');
    openTracking(id);
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ─── REVIEWS ──────────────────────────────────────────────────────────────────
function openReviewModal(bookId) {
  document.getElementById('rvBookId').value = bookId;
  document.getElementById('rvComment').value = '';
  document.getElementById('rvRating').value = '0';
  document.querySelectorAll('.s').forEach(s => s.classList.remove('active'));
  document.getElementById('rvError').classList.add('hidden');
  openModal('modalReview');
}

async function submitReview() {
  const bookId = document.getElementById('rvBookId').value;
  const rating = parseInt(document.getElementById('rvRating').value);
  const comment = document.getElementById('rvComment').value.trim();
  const errEl = document.getElementById('rvError');
  if (!rating) { errEl.textContent = 'Veuillez sélectionner une note.'; errEl.classList.remove('hidden'); return; }
  try {
    await api(`/api/books/${bookId}/reviews`, 'POST', { rating, comment });
    closeModal('modalReview');
    toast('✅ Merci pour votre avis !');
    openBook(bookId);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function initStars() {
  const stars = document.querySelectorAll('#starRow .s');
  stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
      const v = +star.dataset.v;
      stars.forEach(s => s.classList.toggle('hover', +s.dataset.v <= v));
    });
    star.addEventListener('mouseleave', () => {
      stars.forEach(s => s.classList.remove('hover'));
      const cur = +document.getElementById('rvRating').value;
      stars.forEach(s => s.classList.toggle('active', +s.dataset.v <= cur));
    });
    star.addEventListener('click', () => {
      const v = +star.dataset.v;
      document.getElementById('rvRating').value = v;
      stars.forEach(s => s.classList.toggle('active', +s.dataset.v <= v));
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN
// ══════════════════════════════════════════════════════════════════════════════

function switchAdminTab(tab) {
  document.querySelectorAll('.anav').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
  document.getElementById(`atab-${tab}`)?.classList.add('active');
  const titles = {
    dashboard: 'Tableau de bord',
    users: 'Utilisateurs',
    books: 'Livres',
    orders: 'Commandes',
    ads: 'Publicités'
  };
  document.getElementById('adminTabTitle').textContent = titles[tab] || '';
  if (tab === 'dashboard') loadAdminDashboard();
  else if (tab === 'users') loadAdminUsers();
  else if (tab === 'books') loadAdminBooks();
  else if (tab === 'orders') loadAdminOrders();
  else if (tab === 'ads') loadAdminAds();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function loadAdminDashboard() {
  const stats = await adminApi('/api/admin/stats');
  document.getElementById('statCards').innerHTML = `
    <div class="stat-card" onclick="switchAdminTab('books')" style="cursor:pointer">
      <div class="sc-label">Livres</div><div class="sc-value">${stats.books}</div><img class="sc-logo" src="${BRAND_LOGO}" alt="Magma" />
    </div>
    <div class="stat-card" onclick="switchAdminTab('users')" style="cursor:pointer">
      <div class="sc-label">Utilisateurs</div><div class="sc-value">${stats.users}</div><span class="sc-icon">👤</span>
    </div>
    <div class="stat-card" onclick="switchAdminTab('orders')" style="cursor:pointer">
      <div class="sc-label">Commandes</div><div class="sc-value">${stats.orders}</div><span class="sc-icon">📦</span>
    </div>
    <div class="stat-card">
      <div class="sc-label">Revenus</div><div class="sc-value">${fmtPrice(stats.revenue)}</div><span class="sc-icon">💰</span>
    </div>
    <div class="stat-card" onclick="switchAdminTab('orders')" style="cursor:pointer">
      <div class="sc-label">En attente</div><div class="sc-value">${stats.pending}</div><span class="sc-icon">⏳</span>
    </div>
  `;
  const orders = await adminApi('/api/admin/orders');
  const recent = orders.slice(0, 5);
  document.getElementById('recentOrders').innerHTML = recent.length
    ? `<table class="admin-table" style="background:white;border-radius:10px"><thead><tr><th>#</th><th>Client</th><th>Total</th><th>Statut</th><th>Date</th><th></th></tr></thead><tbody>
      ${recent.map(o => `<tr>
        <td style="cursor:pointer;color:var(--red);font-weight:700" onclick="adminOpenOrderDetail(${o.id})">#${o.id}</td>
        <td>${o.customer_name}</td>
        <td>${fmtPrice(o.total)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${fmtDate(o.created_at)}</td>
        <td><button class="btn-icon-sm" onclick="adminOpenOrderDetail(${o.id})">Voir</button></td>
      </tr>`).join('')}
    </tbody></table>`
    : '<p style="color:#999;font-size:.9rem">Aucune commande récente.</p>';
}

// ─── Admin Users ──────────────────────────────────────────────────────────────
async function loadAdminUsers() {
  const users = await adminApi('/api/admin/users');
  const countEl = document.getElementById('usersCount');
  if (countEl) countEl.textContent = `${users.length} utilisateur${users.length !== 1 ? 's' : ''}`;
  const tbody = document.getElementById('adminUsersBody');
  if (!tbody) return;
  tbody.innerHTML = users.length ? users.map(u => `
    <tr style="cursor:pointer" onclick="adminOpenUserDetail(${JSON.stringify(u).replace(/"/g, '&quot;')})">
      <td style="font-weight:700;color:var(--red)">#${u.id}</td>
      <td>
        <div style="display:flex;align-items:center;gap:.6rem">
          <div class="user-avatar-sm">${u.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}</div>
          <span style="font-weight:600">${u.name}</span>
        </div>
      </td>
      <td>${u.email}</td>
      <td>${u.phone || '—'}</td>
      <td><span class="count-pill">${u.order_count} commande${u.order_count !== 1 ? 's' : ''}</span></td>
      <td style="font-weight:700;color:var(--red)">${fmtPrice(u.total_spent)}</td>
      <td style="font-size:.8rem;color:#999">${fmtDate(u.created_at)}</td>
      <td><button class="btn-icon-sm">Voir fiche</button></td>
    </tr>`).join('')
  : '<tr><td colspan="8" style="text-align:center;color:#999;padding:2rem">Aucun utilisateur inscrit.</td></tr>';
}

function adminOpenUserDetail(user) {
  document.getElementById('userDetailTitle').textContent = `Fiche — ${user.name}`;
  document.getElementById('userDetailBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-row"><span class="detail-label">ID</span><span>#${user.id}</span></div>
      <div class="detail-row"><span class="detail-label">Nom complet</span><span>${user.name}</span></div>
      <div class="detail-row"><span class="detail-label">Email</span><span>${user.email}</span></div>
      <div class="detail-row"><span class="detail-label">Téléphone</span><span>${user.phone || '—'}</span></div>
      <div class="detail-row"><span class="detail-label">Commandes</span><span>${user.order_count}</span></div>
      <div class="detail-row"><span class="detail-label">Total dépensé</span><span style="color:var(--red);font-weight:700">${fmtPrice(user.total_spent)}</span></div>
      <div class="detail-row"><span class="detail-label">Inscrit le</span><span>${fmtDate(user.created_at)}</span></div>
    </div>`;
  openModal('modalUserDetail');
}

// ─── Admin Books ──────────────────────────────────────────────────────────────
async function loadAdminBooks() {
  const books = await adminApi('/api/admin/books');
  const cats = await adminApi('/api/admin/books/categories');
  const dl = document.getElementById('catDl');
  if (dl) dl.innerHTML = cats.map(c => `<option value="${c}"></option>`).join('');

  const tbody = document.getElementById('adminBooksBody');
  if (!tbody) return;
  tbody.innerHTML = books.map(b => `
    <tr>
      <td style="cursor:pointer" onclick="adminOpenBookDetail(${b.id})">
        <div style="display:flex;align-items:center;gap:0.8rem">
          ${b.image_url
            ? `<img src="${b.image_url}" class="admin-book-thumb" alt="" />`
            : `<div class="admin-book-fallback"><img src="${BRAND_LOGO}" alt="Magma" /></div>`}
          <div>
            <div style="font-weight:700;font-size:.92rem">${b.title}</div>
            <div style="font-size:.78rem;color:#999">${b.author}</div>
          </div>
        </div>
      </td>
      <td>${b.category}</td>
      <td style="font-weight:700;color:var(--red)">${fmtPrice(b.price)}</td>
      <td>${b.stock}</td>
      <td>
        <div style="display:flex;gap:.4rem">
          <button class="btn-icon-sm" onclick="editBook(${b.id})">✏️ Modifier</button>
          <button class="btn-icon-sm danger" onclick="deleteBook(${b.id})">🗑 Supprimer</button>
        </div>
      </td>
    </tr>`).join('');
}

async function adminOpenBookDetail(id) {
  const b = await adminApi(`/api/admin/books/${id}`);
  document.getElementById('bookDetailTitle').textContent = b.title;
  document.getElementById('bookDetailBody').innerHTML = `
    <div style="display:flex;gap:1.5rem;flex-wrap:wrap;margin-bottom:1rem">
      <div style="width:100px;height:140px;border-radius:8px;overflow:hidden;background:#f5f0e8;display:flex;align-items:center;justify-content:center;font-size:2.5rem;flex-shrink:0">
        ${b.image_url ? `<img src="${b.image_url}" style="width:100%;height:100%;object-fit:cover" />` : `<img src="${BRAND_LOGO}" alt="Magma" style="width:86%;height:auto;object-fit:contain" />`}
      </div>
      <div style="flex:1;min-width:200px">
        <div class="detail-grid">
          <div class="detail-row"><span class="detail-label">Auteur</span><span>${b.author}</span></div>
          <div class="detail-row"><span class="detail-label">Catégorie</span><span>${b.category}</span></div>
          <div class="detail-row"><span class="detail-label">Prix</span><span style="color:var(--red);font-weight:700">${fmtPrice(b.price)}</span></div>
          <div class="detail-row"><span class="detail-label">Stock</span><span>${b.stock}</span></div>
          <div class="detail-row"><span class="detail-label">Note moyenne</span><span>${b.avg_rating ? `⭐ ${b.avg_rating}/5 (${b.reviews.length} avis)` : 'Aucun avis'}</span></div>
        </div>
      </div>
    </div>
    ${b.description ? `<p style="font-size:.9rem;color:#555;line-height:1.6;border-top:1px solid var(--border);padding-top:1rem">${b.description}</p>` : ''}
    ${b.reviews.length ? `
      <div style="margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem">
        <h4 style="margin-bottom:.8rem;font-size:.95rem">Derniers avis clients</h4>
        ${b.reviews.slice(0,3).map(r => `
          <div style="padding:.6rem 0;border-bottom:1px solid #f5f0e8;font-size:.85rem">
            <div style="display:flex;justify-content:space-between">
              <strong>${r.customer_name}</strong>
              <span style="color:#f39c12">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
            </div>
            ${r.comment ? `<p style="color:#666;margin:.2rem 0 0">${r.comment}</p>` : ''}
          </div>`).join('')}
      </div>` : ''}`;
  document.getElementById('bookDetailEditBtn').onclick = () => {
    closeModal('modalBookDetail');
    editBook(id);
  };
  openModal('modalBookDetail');
}

function openBookForm() {
  document.getElementById('bkId').value = '';
  document.getElementById('bkForm').reset();
  document.getElementById('bookFormLabel').textContent = 'Ajouter un livre';
  document.getElementById('adminBookForm').classList.remove('hidden');
  document.getElementById('adminBookForm').scrollIntoView({ behavior: 'smooth' });
}

function closeBookForm() {
  document.getElementById('adminBookForm').classList.add('hidden');
}

async function editBook(id) {
  const b = await adminApi(`/api/admin/books/${id}`);
  document.getElementById('bkId').value = id;
  document.getElementById('bkTitle').value = b.title;
  document.getElementById('bkAuthor').value = b.author;
  document.getElementById('bkDesc').value = b.description || '';
  document.getElementById('bkPrice').value = b.price;
  document.getElementById('bkCategory').value = b.category;
  document.getElementById('bkStock').value = b.stock;
  document.getElementById('bookFormLabel').textContent = 'Modifier le livre';
  document.getElementById('adminBookForm').classList.remove('hidden');
  document.getElementById('adminBookForm').scrollIntoView({ behavior: 'smooth' });
}

async function saveBook(e) {
  e.preventDefault();
  const id = document.getElementById('bkId').value;
  const fd = new FormData();
  fd.append('title', document.getElementById('bkTitle').value);
  fd.append('author', document.getElementById('bkAuthor').value);
  fd.append('description', document.getElementById('bkDesc').value);
  fd.append('price', document.getElementById('bkPrice').value);
  fd.append('category', document.getElementById('bkCategory').value);
  fd.append('stock', document.getElementById('bkStock').value);
  const img = document.getElementById('bkImage').files[0];
  if (img) fd.append('image', img);

  try {
    const res = await fetch(id ? `/api/admin/books/${id}` : '/api/admin/books', {
      method: id ? 'PUT' : 'POST',
      headers: { 'x-admin-token': 'TAF1-FLEMME' },
      body: fd
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    toast(id ? 'Livre modifié !' : 'Livre ajouté !');
    closeBookForm();
    loadAdminBooks();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteBook(id) {
  if (!confirm('Supprimer ce livre définitivement ?')) return;
  await adminApi(`/api/admin/books/${id}`, 'DELETE');
  toast('Livre supprimé');
  loadAdminBooks();
}

// ─── Admin Orders ─────────────────────────────────────────────────────────────
async function loadAdminOrders() {
  const orders = await adminApi('/api/admin/orders');
  const filter = document.getElementById('orderFilter')?.value || '';
  const filtered = filter ? orders.filter(o => o.status === filter) : orders;
  const tbody = document.getElementById('adminOrdersBody');
  if (!tbody) return;
  tbody.innerHTML = filtered.map(o => {
    const items = JSON.parse(o.items || '[]');
    return `
    <tr>
      <td style="font-weight:700;color:var(--red);cursor:pointer" onclick="adminOpenOrderDetail(${o.id})">#${o.id}</td>
      <td>
        <div style="font-weight:600">${o.customer_name}</div>
        <div style="font-size:.78rem;color:#999">${o.customer_phone}</div>
      </td>
      <td style="font-size:.85rem">${o.delivery_zone}</td>
      <td>
        <div style="font-size:.78rem;color:#666">${items.map(i => `${i.title} ×${i.quantity}`).join(', ')}</div>
      </td>
      <td style="font-weight:700">${fmtPrice(o.total)}</td>
      <td>${statusBadge(o.status)}</td>
      <td style="font-size:.8rem;color:#999">${fmtDate(o.created_at)}</td>
      <td>
        <div style="display:flex;gap:.4rem">
          <button class="btn-icon-sm" onclick="adminOpenOrderDetail(${o.id})">👁 Voir</button>
          <button class="btn-icon-sm" onclick="openOrderStatusModal(${o.id},'${o.status}')">✏️ Statut</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function adminOpenOrderDetail(id) {
  const o = await adminApi(`/api/admin/orders`);
  const order = o.find(x => x.id === id);
  if (!order) return;
  const items = JSON.parse(order.items || '[]');
  document.getElementById('orderDetailTitle').textContent = `Commande #${order.id}`;
  document.getElementById('orderDetailBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-row"><span class="detail-label">Statut</span><span>${statusBadge(order.status)}</span></div>
      <div class="detail-row"><span class="detail-label">Client</span><span style="font-weight:600">${order.customer_name}</span></div>
      <div class="detail-row"><span class="detail-label">Email</span><span>${order.customer_email || '—'}</span></div>
      <div class="detail-row"><span class="detail-label">Téléphone</span><span>${order.customer_phone}</span></div>
      <div class="detail-row"><span class="detail-label">Zone</span><span>${order.delivery_zone}</span></div>
      <div class="detail-row"><span class="detail-label">Adresse</span><span>${order.delivery_address}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span>${fmtDate(order.created_at)}</span></div>
      ${order.tracking_note ? `<div class="detail-row"><span class="detail-label">Note de suivi</span><span>${order.tracking_note}</span></div>` : ''}
    </div>
    <div style="margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem">
      <h4 style="margin-bottom:.8rem;font-size:.95rem">Produits commandés</h4>
      ${items.map(i => `
        <div style="display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid #f5f0e8;font-size:.9rem">
          <span>${i.title} <span style="color:#999">×${i.quantity}</span></span>
          <span style="font-weight:600">${fmtPrice(i.price * i.quantity)}</span>
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;font-weight:700;color:var(--red);padding-top:.6rem;font-size:1rem">
        <span>Total</span><span>${fmtPrice(order.total)}</span>
      </div>
    </div>`;
  document.getElementById('orderDetailUpdateBtn').onclick = () => {
    closeModal('modalOrderDetail');
    openOrderStatusModal(order.id, order.status);
  };
  openModal('modalOrderDetail');
}

function openOrderStatusModal(id, currentStatus) {
  document.getElementById('updateOrderId').value = id;
  document.getElementById('newOrderStatus').value = currentStatus;
  document.getElementById('trackingNote').value = '';
  openModal('modalOrderStatus');
}

async function doUpdateOrderStatus() {
  const id = document.getElementById('updateOrderId').value;
  const status = document.getElementById('newOrderStatus').value;
  const note = document.getElementById('trackingNote').value;
  await adminApi(`/api/admin/orders/${id}/status`, 'PUT', { status, tracking_note: note });
  toast('Commande mise à jour');
  closeModal('modalOrderStatus');
  loadAdminOrders();
}

// ─── Admin Ads ────────────────────────────────────────────────────────────────
async function loadAdminAds() {
  const ads = await api('/api/ads');
  document.getElementById('adminAdsList').innerHTML = ads.length
    ? ads.map(a => `
      <div class="ad-admin-row">
        <div class="ad-admin-info">
          <strong>${a.title}</strong>
          <span>${a.content.slice(0, 70)}${a.content.length > 70 ? '…' : ''}</span>
        </div>
        <button class="btn-icon-sm danger" onclick="deleteAd(${a.id})">🗑 Supprimer</button>
      </div>`).join('')
    : '<p style="color:#999;font-size:.9rem">Aucune publicité active.</p>';
}

async function createAd(e) {
  e.preventDefault();
  const fd = new FormData();
  fd.append('title', document.getElementById('adTitle').value);
  fd.append('content', document.getElementById('adContent').value);
  const img = document.getElementById('adImage').files[0];
  if (img) fd.append('image', img);
  try {
    const res = await fetch('/api/admin/ads', { method: 'POST', headers: { 'x-admin-token': 'TAF1-FLEMME' }, body: fd });
    if (!res.ok) throw new Error('Erreur');
    toast('Publicité publiée !');
    e.target.reset();
    loadAdminAds();
  } catch { toast('Erreur', 'error'); }
}

async function deleteAd(id) {
  if (!confirm('Supprimer cette publicité ?')) return;
  await adminApi(`/api/admin/ads/${id}`, 'DELETE');
  toast('Publicité supprimée');
  loadAdminAds();
}

// ─── Téléchargement du code source (admin uniquement) ─────────────────────────
async function downloadSource() {
  try {
    toast('Préparation du téléchargement…', 'info');
    const res = await fetch('/api/download-source', {
      headers: { 'x-admin-token': 'TAF1-FLEMME' }
    });
    if (!res.ok) throw new Error('Accès refusé');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'librairie-mayombe-source.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Code source téléchargé !');
  } catch (err) {
    toast(err.message || 'Erreur de téléchargement', 'error');
  }
}

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function api(url, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const opts = { method, headers, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || 'Erreur serveur');
    err.action = data.action || null;
    throw err;
  }
  return data;
}

async function adminApi(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'x-admin-token': 'TAF1-FLEMME' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

// ─── Modal helpers ────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) closeModal(e.target.id);
});

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || '✅'}</span><span>${msg}</span>`;
  document.getElementById('toastStack').appendChild(el);
  setTimeout(() => { el.style.animation = 'tout .3s forwards'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function togglePw(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}
function fmtPrice(n) { return Number(n).toLocaleString('fr-FR') + ' FCFA'; }
function fmtDate(d) { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
function esc(s) { return String(s).replace(/'/g, "\\'").replace(/"/g, '\\"'); }
function statusBadge(s) {
  const map = { pending: ['sb-pending', 'En attente'], confirmed: ['sb-confirmed', 'Confirmée'], shipping: ['sb-shipping', 'En livraison'], delivered: ['sb-delivered', 'Livrée'], cancelled: ['sb-cancelled', 'Annulée'] };
  const [cls, label] = map[s] || ['sb-pending', s];
  return `<span class="status-badge ${cls}">${label}</span>`;
}
