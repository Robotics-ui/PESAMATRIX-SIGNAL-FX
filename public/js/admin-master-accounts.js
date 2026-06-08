let accounts = [];

async function loadAccounts() {
  const tbody = document.getElementById('accountsBody');
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px"><div class="spinner"></div></td></tr>`;

  const res = await apiFetch('/api/admin/master-accounts');
  if (!res.ok) { showAlert('alertBox', 'error', 'Failed to load master accounts.'); return; }

  accounts = await res.json();
  renderTable();

  document.getElementById('statTotal').textContent = accounts.length;
  document.getElementById('statActive').textContent = accounts.filter(a => a.status === 'active').length;
}

function riskBadge(level) {
  const cls = level === 'low' ? 'badge-green' : level === 'high' ? 'badge-risk-high' : 'badge-risk-medium';
  return `<span class="badge ${cls}" style="text-transform:capitalize">${escHtml(level)}</span>`;
}

function statusBadge(status) {
  return status === 'active'
    ? `<span class="badge badge-green">Active</span>`
    : `<span class="badge badge-gray">Disabled</span>`;
}

function renderTable() {
  const tbody = document.getElementById('accountsBody');
  if (!accounts.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">No master accounts yet. Add one to get started.</td></tr>`;
    return;
  }

  tbody.innerHTML = accounts.map(a => `
    <tr>
      <td style="color:var(--text);font-weight:600">${escHtml(a.providerName)}</td>
      <td>${escHtml(a.brokerName)}</td>
      <td>${riskBadge(a.riskLevel)}</td>
      <td style="color:var(--accent)">${Number(a.winRate).toFixed(1)}%</td>
      <td style="color:${parseFloat(a.monthlyReturn)>=0?'var(--accent)':'var(--danger)'}">
        ${parseFloat(a.monthlyReturn)>=0?'+':''}${Number(a.monthlyReturn).toFixed(1)}%
      </td>
      <td>${statusBadge(a.status)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="openEdit('${a.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAccount('${a.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAdd() {
  document.getElementById('modalTitle').textContent = 'Add Master Account';
  document.getElementById('editId').value = '';
  document.getElementById('accountForm').reset();
  document.getElementById('riskLevel').value = 'medium';
  document.getElementById('status').value = 'active';
  document.getElementById('accountModal').classList.remove('hidden');
}

function openEdit(id) {
  const a = accounts.find(x => x.id === id);
  if (!a) return;
  document.getElementById('modalTitle').textContent = 'Edit Master Account';
  document.getElementById('editId').value = a.id;
  document.getElementById('providerName').value = a.providerName;
  document.getElementById('mt5Login').value = a.mt5Login;
  document.getElementById('brokerName').value = a.brokerName;
  document.getElementById('serverName').value = a.serverName;
  document.getElementById('strategyDescription').value = a.strategyDescription || '';
  document.getElementById('riskLevel').value = a.riskLevel;
  document.getElementById('winRate').value = a.winRate;
  document.getElementById('totalTrades').value = a.totalTrades;
  document.getElementById('monthlyReturn').value = a.monthlyReturn;
  document.getElementById('maxDrawdown').value = a.maxDrawdown;
  document.getElementById('status').value = a.status;
  document.getElementById('accountModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('accountModal').classList.add('hidden');
}

async function saveAccount(e) {
  e.preventDefault();
  const editId = document.getElementById('editId').value;
  const payload = {
    providerName: document.getElementById('providerName').value.trim(),
    mt5Login: document.getElementById('mt5Login').value.trim(),
    brokerName: document.getElementById('brokerName').value.trim(),
    serverName: document.getElementById('serverName').value.trim(),
    strategyDescription: document.getElementById('strategyDescription').value.trim() || null,
    riskLevel: document.getElementById('riskLevel').value,
    winRate: parseFloat(document.getElementById('winRate').value) || 0,
    totalTrades: parseInt(document.getElementById('totalTrades').value) || 0,
    monthlyReturn: parseFloat(document.getElementById('monthlyReturn').value) || 0,
    maxDrawdown: parseFloat(document.getElementById('maxDrawdown').value) || 0,
    status: document.getElementById('status').value,
  };

  const method = editId ? 'PUT' : 'POST';
  const url = editId ? `/api/admin/master-accounts/${editId}` : '/api/admin/master-accounts';

  const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
  const data = await res.json();

  if (res.ok) {
    closeModal();
    if (editId) {
      accounts = accounts.map(a => a.id === editId ? data : a);
    } else {
      accounts.unshift(data);
    }
    renderTable();
    document.getElementById('statTotal').textContent = accounts.length;
    document.getElementById('statActive').textContent = accounts.filter(a => a.status === 'active').length;
    showAlert('alertBox', 'success', editId ? 'Account updated.' : 'Account added.');
  } else {
    showAlert('alertBox', 'error', data.error || 'Save failed.');
  }
}

async function deleteAccount(id) {
  if (!confirm('Permanently delete this master account? This cannot be undone.')) return;
  const res = await apiFetch(`/api/admin/master-accounts/${id}`, { method: 'DELETE' });
  if (res.ok) {
    accounts = accounts.filter(a => a.id !== id);
    renderTable();
    document.getElementById('statTotal').textContent = accounts.length;
    document.getElementById('statActive').textContent = accounts.filter(a => a.status === 'active').length;
    showAlert('alertBox', 'success', 'Account deleted.');
  } else {
    const data = await res.json();
    showAlert('alertBox', 'error', data.error || 'Delete failed.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  if (!requireAdmin()) return;
  initSidebar('master-accounts');
  loadAccounts();

  document.getElementById('addBtn')?.addEventListener('click', openAdd);
  document.getElementById('accountForm')?.addEventListener('submit', saveAccount);
  document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
  document.getElementById('cancelBtn')?.addEventListener('click', closeModal);
  document.getElementById('accountModal')?.addEventListener('click', e => { if (e.target === document.getElementById('accountModal')) closeModal(); });
});
