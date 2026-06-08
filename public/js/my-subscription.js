async function loadMySubscription() {
  const res = await apiFetch('/api/subscription/my');
  if (!res.ok) { showAlert('alertBox', 'error', 'Failed to load subscription data.'); return; }

  const { subscription: sub, providerSubscription: prov, daysRemaining } = await res.json();

  const subCard = document.getElementById('subCard');
  const noSubCard = document.getElementById('noSubCard');

  if (!sub) {
    subCard.style.display = 'none';
    noSubCard.style.display = 'block';
    renderProviderSection(null);
    return;
  }

  noSubCard.style.display = 'none';
  subCard.style.display = 'block';

  const totalDays = sub.tradingDays || 0;
  const pct = totalDays > 0 ? Math.round((daysRemaining / ((new Date(sub.expiresAt) - new Date(sub.startsAt)) / 86400000)) * 100) : 0;

  document.getElementById('subStatus').innerHTML = `<span class="badge badge-green">Active</span>`;
  document.getElementById('subTradingDays').textContent = `${sub.tradingDays} trading days`;
  document.getElementById('subTotal').textContent = `KES ${Number(sub.totalAmount).toLocaleString()}`;
  document.getElementById('subStarted').textContent = formatDate(sub.startsAt);
  document.getElementById('subExpiry').textContent = formatDateLong(sub.expiresAt);
  document.getElementById('subDaysLeft').textContent = daysRemaining;
  const dl2 = document.getElementById('subDaysLeft2');
  if (dl2) dl2.textContent = `${daysRemaining} days left`;

  const bar = document.getElementById('subProgressBar');
  if (bar) bar.style.width = Math.max(2, pct) + '%';

  renderProviderSection(prov);
}

function renderProviderSection(prov) {
  const el = document.getElementById('providerSection');
  if (!prov) {
    el.innerHTML = `<div class="card" style="margin-top:16px">
      <div class="card-header"><div class="card-title">Provider</div></div>
      <div class="empty-state" style="padding:30px 0">
        <div class="empty-icon" style="font-size:28px">📊</div>
        <div class="empty-title">No provider selected</div>
        <div class="empty-desc">Choose a provider to follow from the Providers page.</div>
        <a href="/providers.html" class="btn btn-primary" style="margin-top:14px">Browse Providers</a>
      </div>
    </div>`;
    return;
  }

  el.innerHTML = `<div class="card" style="margin-top:16px">
    <div class="card-header">
      <div class="card-title">Active Provider</div>
      <span class="badge badge-green">Following</span>
    </div>
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <div class="user-avatar" style="width:46px;height:46px;font-size:18px">${escHtml(prov.providerName[0])}</div>
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--text)">${escHtml(prov.providerName)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${escHtml(prov.brokerName)}</div>
      </div>
    </div>
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
      <div class="stat-card" style="padding:14px">
        <div class="stat-label">Win Rate</div>
        <div class="stat-value stat-accent" style="font-size:20px">${Number(prov.winRate).toFixed(1)}%</div>
      </div>
      <div class="stat-card" style="padding:14px">
        <div class="stat-label">Monthly Return</div>
        <div class="stat-value" style="font-size:20px;color:${parseFloat(prov.monthlyReturn)>=0?'var(--accent)':'var(--danger)'}">
          ${parseFloat(prov.monthlyReturn)>=0?'+':''}${Number(prov.monthlyReturn).toFixed(1)}%
        </div>
      </div>
      <div class="stat-card" style="padding:14px">
        <div class="stat-label">Started</div>
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-top:6px">${formatDate(prov.startedAt)}</div>
      </div>
    </div>
    <a href="/providers.html" class="btn btn-ghost btn-sm">Change Provider</a>
  </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initSidebar('my-subscription');
  loadMySubscription();
});
