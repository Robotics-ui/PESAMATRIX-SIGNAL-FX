async function loadSettings() {
  const res = await apiFetch('/api/admin/subscription-settings');
  if (!res.ok) { showAlert('alertBox', 'error', 'Failed to load settings.'); return; }

  const s = await res.json();
  document.getElementById('feePerDay').value = Number(s.feePerDay).toFixed(2);
  document.getElementById('minDays').value = s.minDays;
  document.getElementById('maxDays').value = s.maxDays;
  document.getElementById('isActive').checked = s.isActive;
  updatePreview();
}

function updatePreview() {
  const fee = parseFloat(document.getElementById('feePerDay').value) || 0;
  const min = parseInt(document.getElementById('minDays').value) || 0;
  const max = parseInt(document.getElementById('maxDays').value) || 0;
  const active = document.getElementById('isActive').checked;

  document.getElementById('prevFee').textContent = `KES ${fee.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
  document.getElementById('prevMin').textContent = `${min} days`;
  document.getElementById('prevMax').textContent = `${max} days`;
  document.getElementById('prevMin$').textContent = `KES ${(fee * min).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
  document.getElementById('prevMax$').textContent = `KES ${(fee * max).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
  document.getElementById('prevStatus').textContent = active ? 'Enabled' : 'Disabled';
  document.getElementById('prevStatus').className = `badge ${active ? 'badge-green' : 'badge-gray'}`;
}

async function saveSettings(e) {
  e.preventDefault();
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const payload = {
    feePerDay: parseFloat(document.getElementById('feePerDay').value),
    minDays: parseInt(document.getElementById('minDays').value),
    maxDays: parseInt(document.getElementById('maxDays').value),
    isActive: document.getElementById('isActive').checked,
  };

  const res = await apiFetch('/api/admin/subscription-settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  btn.disabled = false;
  btn.textContent = 'Save Settings';

  if (res.ok) {
    showAlert('alertBox', 'success', 'Subscription settings saved successfully.');
  } else {
    showAlert('alertBox', 'error', data.error || 'Save failed.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  if (!requireAdmin()) return;
  initSidebar('subscription-settings');
  loadSettings();

  document.getElementById('settingsForm')?.addEventListener('submit', saveSettings);
  ['feePerDay', 'minDays', 'maxDays', 'isActive'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updatePreview);
    document.getElementById(id)?.addEventListener('change', updatePreview);
  });
});
