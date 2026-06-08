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
  localStorage.removeItem('pmx_access');
  localStorage.removeItem('pmx_refresh');
  localStorage.removeItem('pmx_user');
  window.location.href = '/';
}

function requireAuth() {
  if (!getToken()) { window.location.href = '/'; return false; }
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
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showAlert(containerId, type, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => { el.innerHTML = ''; }, 4000);
}

function initSidebar(activePage) {
  const user = getUser();

  const avatar = document.getElementById('sidebarAvatar');
  const email = document.getElementById('sidebarEmail');
  const role = document.getElementById('sidebarRole');
  if (avatar) avatar.textContent = (user.email || 'U')[0].toUpperCase();
  if (email) email.textContent = user.email || '';
  if (role) role.textContent = user.role || '';

  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.dataset.page === activePage) link.classList.add('active');
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
}
