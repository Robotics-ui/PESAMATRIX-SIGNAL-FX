const API = '';

function getToken() { return localStorage.getItem('pmx_access'); }
function getRefresh() { return localStorage.getItem('pmx_refresh'); }
function getUser() { try { return JSON.parse(localStorage.getItem('pmx_user') || '{}'); } catch { return {}; } }

function setAuth(access, refresh, user) {
  localStorage.setItem('pmx_access', access);
  localStorage.setItem('pmx_refresh', refresh);
  localStorage.setItem('pmx_user', JSON.stringify(user));
}

function logout() {
  localStorage.clear();
  window.location.href = '/';
}

function requireAuth() {
  if (!getToken()) { window.location.href = '/'; return false; }
  return true;
}

function requireAdmin() {
  const user = getUser();
  if (user.role !== 'admin') { window.location.href = '/dashboard.html'; return false; }
  return true;
}

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const isFormData = opts.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  };

  let res = await fetch(API + path, { ...opts, headers });

  if (res.status === 401 || res.status === 403) {
    const refresh = getRefresh();
    if (refresh) {
      const rr = await fetch(API + '/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (rr.ok) {
        const data = await rr.json();
        localStorage.setItem('pmx_access', data.accessToken);
        headers.Authorization = `Bearer ${data.accessToken}`;
        res = await fetch(API + path, { ...opts, headers });
        return res;
      }
    }
    logout();
    return res;
  }
  return res;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateLong(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function showAlert(containerId, type, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}">${escHtml(message)}</div>`;
  if (type === 'success') setTimeout(() => { if (el) el.innerHTML = ''; }, 5000);
}

function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Trading day calculator (Mon–Fri only)
function addTradingDays(startDate, tradingDays) {
  const d = new Date(startDate);
  let count = 0;
  while (count < tradingDays) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) count++;
  }
  return d;
}

// ── Sidebar ─────────────────────────────────────────
function buildSidebar(activePage) {
  const user = getUser();
  const isAdmin = user.role === 'admin';
  const ava = (user.email || 'U')[0].toUpperCase();

  const link = (href, page, icon, label) => `
    <a href="${href}" class="nav-link ${activePage === page ? 'active' : ''}" data-page="${page}">
      ${icon}<span>${label}</span>
    </a>`;

  const ic = {
    dash: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    sub:  `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    prov: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    my:   `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    med:  `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    con:  `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 010 1.09 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>`,
    ma:   `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>`,
    set:  `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
  };

  return `<aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-symbol">P</div>
      <div class="logo-name">P<span>MATRIX</span></div>
    </div>
    <nav class="sidebar-nav">
      ${link('/dashboard.html', 'dashboard', ic.dash, 'Dashboard')}
      <div class="nav-divider"></div>
      ${link('/subscription.html', 'subscription', ic.sub, 'Subscription Plans')}
      ${link('/providers.html', 'providers', ic.prov, 'Providers')}
      ${link('/my-subscription.html', 'my-subscription', ic.my, 'My Subscription')}
      <div class="nav-divider"></div>
      ${link('/media.html', 'media', ic.med, 'Media Library')}
      ${link('/contacts.html', 'contacts', ic.con, 'Contacts')}
      ${isAdmin ? `
        <div class="nav-divider"></div>
        <div style="padding:6px 12px 2px;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px">Admin</div>
        ${link('/admin/master-accounts.html', 'master-accounts', ic.ma, 'Master Accounts')}
        ${link('/admin/subscription-settings.html', 'subscription-settings', ic.set, 'Sub. Settings')}
      ` : ''}
    </nav>
    <div class="sidebar-footer">
      <div class="user-avatar">${ava}</div>
      <div class="user-meta">
        <span class="user-email">${escHtml(user.email || '')}</span>
        <span class="user-role">${escHtml(user.role || '')}</span>
      </div>
      <button class="logout-btn" id="logoutBtn" title="Sign out">⏻</button>
    </div>
  </aside>`;
}

function initSidebar(activePage) {
  const container = document.getElementById('sidebarContainer');
  if (container) {
    container.innerHTML = buildSidebar(activePage);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
  }
}
