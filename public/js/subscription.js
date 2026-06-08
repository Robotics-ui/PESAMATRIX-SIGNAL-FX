let settings = null;

async function loadSettings() {
  const res = await apiFetch('/api/subscription/settings');
  if (!res.ok) { showAlert('alertBox', 'error', 'Failed to load subscription settings.'); return; }
  settings = await res.json();

  if (!settings.isActive) {
    document.getElementById('subContent').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <div class="empty-title">Subscriptions Unavailable</div>
        <div class="empty-desc">The administrator has temporarily disabled subscriptions. Please check back later.</div>
      </div>`;
    return;
  }

  const slider = document.getElementById('daysSlider');
  slider.min = settings.minDays;
  slider.max = settings.maxDays;
  slider.value = settings.minDays;

  document.getElementById('feePerDay').textContent = `KES ${Number(settings.feePerDay).toLocaleString()}`;
  document.getElementById('minDaysLabel').textContent = settings.minDays;
  document.getElementById('maxDaysLabel').textContent = settings.maxDays;

  updateCalculation();
  document.getElementById('subContent').style.display = 'block';
  document.getElementById('loadingState').style.display = 'none';
}

function updateCalculation() {
  if (!settings) return;
  const days = parseInt(document.getElementById('daysSlider').value);
  const fee = parseFloat(settings.feePerDay);
  const total = days * fee;
  const expiry = addTradingDays(new Date(), days);
  const fmtTotal = total.toLocaleString('en-KE', { minimumFractionDigits: 2 });

  document.getElementById('selectedDays').textContent = days;
  document.getElementById('feeDisplay').textContent = `KES ${fee.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
  document.getElementById('totalAmount').textContent = `KES ${fmtTotal}`;
  document.getElementById('expiryDate').textContent = formatDateLong(expiry);
  document.getElementById('sliderValue').textContent = `${days} trading day${days !== 1 ? 's' : ''}`;
  document.getElementById('paymentAmount').textContent = `KES ${fmtTotal}`;
  document.getElementById('paymentDays').textContent = `${days} trading day${days !== 1 ? 's' : ''}`;
}

async function handlePurchase() {
  if (!settings) return;
  const days = parseInt(document.getElementById('daysSlider').value);
  const phone = document.getElementById('mpesaPhone').value.trim();

  if (!phone || phone.length < 10) {
    showAlert('alertBox', 'error', 'Enter a valid M-Pesa phone number (e.g. 0712345678 or +254712345678).');
    return;
  }

  const btn = document.getElementById('purchaseBtn');
  btn.disabled = true;
  btn.textContent = 'Processing…';

  const res = await apiFetch('/api/subscription/purchase', {
    method: 'POST',
    body: JSON.stringify({ tradingDays: days, phoneNumber: phone }),
  });

  const data = await res.json();

  if (res.ok) {
    showAlert('alertBox', 'success', `Subscription activated! ${days} trading days, expires ${formatDateLong(data.expiresAt)}.`);
    setTimeout(() => { window.location.href = '/my-subscription.html'; }, 2500);
  } else {
    showAlert('alertBox', 'error', data.error || 'Purchase failed.');
    btn.disabled = false;
    btn.textContent = 'Activate Subscription';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initSidebar('subscription');
  loadSettings();

  document.getElementById('daysSlider')?.addEventListener('input', updateCalculation);
  document.getElementById('purchaseBtn')?.addEventListener('click', handlePurchase);
});
