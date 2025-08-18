document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const forgotForm = document.getElementById('forgotForm');
  const resetForm = document.getElementById('resetForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const res = await fetch(window.APP_CONFIG.API_BASE_URL + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      const msg = document.getElementById('loginMsg');
      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('isPremium', data.isPremium ? '1' : '0');
        window.location.href = './dashboard.html';
      } else {
        msg.textContent = data.message || 'Login failed';
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('signupUsername').value.trim();
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;
      const res = await fetch(window.APP_CONFIG.API_BASE_URL + '/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      const msg = document.getElementById('signupMsg');
      if (data.success) {
        msg.textContent = 'Signup successful. You can log in now.';
        setTimeout(()=> window.location.href='./index.html', 1000);
      } else {
        msg.textContent = data.message || 'Signup failed';
      }
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgotEmail').value.trim();
      const res = await fetch(window.APP_CONFIG.API_BASE_URL + '/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      document.getElementById('forgotMsg').textContent = data.message || (data.success ? 'Email sent' : 'Failed to send email');
    });
  }

  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const password = document.getElementById('resetPassword').value;
      const res = await fetch(window.APP_CONFIG.API_BASE_URL + '/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      document.getElementById('resetMsg').textContent = data.message || (data.success ? 'Password updated' : 'Reset failed');
      if (data.success) setTimeout(()=> window.location.href='./index.html', 1200);
    });
  }
});
