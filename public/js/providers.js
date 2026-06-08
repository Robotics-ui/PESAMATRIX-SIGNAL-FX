let providers = [];
let myProviderId = null;
let hasActiveSub = false;

async function loadData() {
  const [provRes, subRes] = await Promise.all([
    apiFetch('/api/master-accounts'),
    apiFetch('/api/subscription/my'),
  ]);

  if (provRes.ok) providers = await provRes.json();
  if (subRes.ok) {
    const subData = await subRes.json();
    hasActiveSub = !!subData.subscription;
    myProviderId = subData.providerSubscription?.masterAccountId || null;
  }

  renderProviders();

  if (!hasActiveSub) {
    document.getElementById('noSubBanner').style.display = 'flex';
  }
}

function riskColor(level) {
  if (level === 'low') return 'badge-green';
  if (level === 'high') return 'badge-risk-high';
  return 'badge-risk-medium';
}

function renderProviders() {
  const grid = document.getElementById('providersGrid');
  if (!providers.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">📊</div>
      <div class="empty-title">No providers available</div>
      <div class="empty-desc">The administrator has not added any master accounts yet.</div>
    </div>`;
    return;
  }

  grid.innerHTML = providers.map(p => {
    const isSelected = p.id === myProviderId;
    return `<div class="provider-card ${isSelected ? 'provider-card--selected' : ''}">
      <div class="provider-card-header">
        <div>
          <div class="provider-name">${escHtml(p.providerName)}</div>
          <div class="provider-broker">${escHtml(p.brokerName)} · ${escHtml(p.serverName)}</div>
        </div>
        <span class="badge ${riskColor(p.riskLevel)}" style="text-transform:capitalize">${escHtml(p.riskLevel)}</span>
      </div>

      <div class="provider-stats">
        <div class="provider-stat">
          <div class="provider-stat-value stat-accent">${Number(p.winRate).toFixed(1)}%</div>
          <div class="provider-stat-label">Win Rate</div>
        </div>
        <div class="provider-stat">
          <div class="provider-stat-value">${p.totalTrades.toLocaleString()}</div>
          <div class="provider-stat-label">Total Trades</div>
        </div>
        <div class="provider-stat">
          <div class="provider-stat-value" style="color:${parseFloat(p.monthlyReturn)>=0?'var(--accent)':'var(--danger)'}">
            ${parseFloat(p.monthlyReturn) >= 0 ? '+' : ''}${Number(p.monthlyReturn).toFixed(1)}%
          </div>
          <div class="provider-stat-label">Monthly Return</div>
        </div>
        <div class="provider-stat">
          <div class="provider-stat-value" style="color:var(--danger)">${Number(p.maxDrawdown).toFixed(1)}%</div>
          <div class="provider-stat-label">Max Drawdown</div>
        </div>
      </div>

      ${p.strategyDescription ? `<p class="provider-desc">${escHtml(p.strategyDescription)}</p>` : ''}

      <div style="margin-top:14px">
        ${isSelected
          ? `<button class="btn btn-ghost btn-sm" onclick="unsub()" style="width:100%;justify-content:center">✓ Currently Following — Unsubscribe</button>`
          : `<button class="btn btn-primary btn-sm" onclick="subscribe('${p.id}')" style="width:100%;justify-content:center"
              ${!hasActiveSub ? 'disabled title="Active subscription required"' : ''}>
              Follow This Provider
            </button>`
        }
      </div>
    </div>`;
  }).join('');
}

async function subscribe(masterAccountId) {
  const res = await apiFetch('/api/subscription/provider', {
    method: 'POST',
    body: JSON.stringify({ masterAccountId }),
  });
  const data = await res.json();
  if (res.ok) {
    myProviderId = masterAccountId;
    showAlert('alertBox', 'success', 'Provider selected successfully!');
    renderProviders();
  } else {
    showAlert('alertBox', 'error', data.error || 'Failed to subscribe.');
  }
}

async function unsub() {
  if (!confirm('Unsubscribe from this provider?')) return;
  const res = await apiFetch('/api/subscription/provider', { method: 'DELETE' });
  if (res.ok) {
    myProviderId = null;
    showAlert('alertBox', 'success', 'Unsubscribed from provider.');
    renderProviders();
  } else {
    const data = await res.json();
    showAlert('alertBox', 'error', data.error || 'Failed to unsubscribe.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initSidebar('providers');
  loadData();
});
