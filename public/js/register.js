document.addEventListener('DOMContentLoaded', () => {
  if (getToken()) { window.location.href = '/dashboard.html'; return; }

  const form = document.getElementById('registerForm');
  const btn = document.getElementById('registerBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      showAlert('alertBox', 'error', 'Passwords do not match.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account…';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phoneNumber, password, confirmPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        showAlert('alertBox', 'success', 'Account created! Redirecting to sign in…');
        setTimeout(() => { window.location.href = '/'; }, 1800);
      } else {
        showAlert('alertBox', 'error', data.error || 'Registration failed.');
        btn.disabled = false;
        btn.textContent = 'Create Account';
      }
    } catch {
      showAlert('alertBox', 'error', 'Network error. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
});
