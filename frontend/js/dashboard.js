import { authHeader, requireAuth, setUserBadge } from './util.js';

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();

  const btnLogout  = document.getElementById('btnLogout');
  const btnExport  = document.getElementById('btnExport');
  const btnUpgrade = document.getElementById('btnUpgrade');
  const form       = document.getElementById('expenseForm');
  const btnClear   = document.getElementById('btnClear');
  const perPageSelect = document.getElementById('perPage');
  const leaderboardSection = document.getElementById('leaderboardSection');

  // ------- date picker (desktop convenience) -------
  const dateEl = document.getElementById('date');
  if (dateEl) {
    const openPicker = () => dateEl.showPicker && dateEl.showPicker();
    dateEl.addEventListener('focus', openPicker);
    dateEl.addEventListener('click', openPicker);
    dateEl.addEventListener('keydown', (e) => {
      if (!['Tab','Shift','Escape','Enter'].includes(e.key)) openPicker();
    });
  }

  // ------- UI helpers -------
  function updatePremiumUI(isPremium) {
    setUserBadge(isPremium);
    if (btnExport) btnExport.disabled = !isPremium;

    if (btnUpgrade) {
      btnUpgrade.textContent = isPremium ? ' You are now Premium user✓': 'Go Premium';
      btnUpgrade.disabled = !!isPremium;
      btnUpgrade.classList.toggle('btn-disabled', !!isPremium);
      btnUpgrade.setAttribute('aria-disabled', isPremium ? 'true' : 'false');
    }

    if (leaderboardSection) {
      leaderboardSection.style.display = isPremium ? '' : 'none';
    }
  }

  // Initial premium state from localStorage
  let isPremium = localStorage.getItem('isPremium') === '1';
  updatePremiumUI(isPremium);

  // ------- state for pagination -------
  let page  = 1;
  let limit = perPageSelect ? parseInt(perPageSelect.value, 10) : 5;

  // ------- auth actions -------
  btnLogout?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('isPremium');
    window.location.href = './index.html';
  });

  // ------- Cashfree helpers -------
  async function loadCashfreeSDK() {
    if (window.Cashfree) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function pollOrderStatus(orderId, timeoutMs = 120000, intervalMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const r = await fetch(
        `${window.APP_CONFIG.API_BASE_URL}/api/subscription/status?order_id=${encodeURIComponent(orderId)}`,
        { headers: { ...authHeader() } } // status can be public; auth header doesn't hurt
      );
      const d = await r.json().catch(() => ({}));
      if (d?.success && (d.status === 'PAID' || d.status === 'SUCCESS')) return true;
      await new Promise(res => setTimeout(res, intervalMs));
    }
    return false;
  }

  // ------- Go Premium -------
  btnUpgrade?.addEventListener('click', async () => {
    // Already premium? Don’t start payment.
    if (localStorage.getItem('isPremium') === '1') {
      alert("You're already Premium. Thanks!");
      return;
    }
    // Prevent double-clicks
    if (btnUpgrade.disabled) return;
    btnUpgrade.disabled = true;
    const originalText = btnUpgrade.textContent;
    btnUpgrade.textContent = 'Opening…';

    try {
      const res = await fetch(
        `${window.APP_CONFIG.API_BASE_URL}/api/subscription/create-order`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({ plan: 'premium_199', amount: 199.00 }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        alert(data?.message || 'Failed to start payment.');
        return;
      }

      // Prefer session checkout
      if (data.payment_session_id) {
        await loadCashfreeSDK();
        const cashfree = window.Cashfree({
          mode: (window.APP_CONFIG?.CF_MODE || 'sandbox') // 'sandbox' or 'production'
        });

        await cashfree.checkout({ paymentSessionId: data.payment_session_id });

        // After return, poll backend for final status
        if (data.order_id) {
          const ok = await pollOrderStatus(data.order_id);
          if (ok) {
            await syncPremiumFromServer();
            alert('Payment success. Premium unlocked!');
            return;
          }
        }
        // Fallback sync
        await syncPremiumFromServer();
        alert('If payment was successful, premium will unlock shortly.');
        return;
      }

      // Fallback: hosted payment link
      if (data.payment_link) {
        window.location.href = data.payment_link;
        return;
      }

      alert('Payment init failed (no session id / payment link).');
    } catch (e) {
      console.error(e);
      alert('Error starting payment.');
    } finally {
      // Keep button disabled if user became premium
      const nowPremium = localStorage.getItem('isPremium') === '1';
      updatePremiumUI(nowPremium);
      if (!nowPremium) {
        btnUpgrade.disabled = false;
        btnUpgrade.textContent = originalText;
      }
    }
  });

  // ------- Export -------
  btnExport?.addEventListener('click', async () => {
    const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}/api/export/csv`, {
      headers: { ...authHeader() },
    });
    if (res.status === 403) {
      alert('Premium required to export.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  // ------- Per page -------
  perPageSelect?.addEventListener('change', () => {
    limit = parseInt(perPageSelect.value, 10) || 5;
    page = 1;
    loadExpenses();
  });

  // ------- Form actions -------
  btnClear?.addEventListener('click', () => {
    form?.reset();
    const idEl = document.getElementById('expenseId');
    if (idEl) idEl.value = '';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('expenseId').value;
    const payload = {
      description: document.getElementById('description').value.trim(),
      category: document.getElementById('category').value.trim(),
      amount: parseFloat(document.getElementById('amount').value),
      date: document.getElementById('date').value
    };
    const url = `${window.APP_CONFIG.API_BASE_URL}/api/expenses${id ? '/' + id : ''}`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    document.getElementById('formMsg').textContent = data.message || (data.success ? 'Saved!' : 'Failed');
    if (data.success) {
      form.reset();
      document.getElementById('expenseId').value = '';
      await loadExpenses();
      await refreshLeaderboard();
    }
  });

  // ------- Expenses -------
  async function loadExpenses() {
    const res = await fetch(
      `${window.APP_CONFIG.API_BASE_URL}/api/expenses?page=${page}&limit=${limit}`,
      { headers: { ...authHeader() } }
    );
    const data = await res.json();
    const tbody = document.querySelector('#expenseTable tbody');
    tbody.innerHTML = '';
    if (data.success && data.items) {
      for (const exp of data.items) {
        const tr = document.createElement('tr');
        const date = new Date(exp.date).toISOString().slice(0,10);
        tr.innerHTML = `
          <td>${exp.description}</td>
          <td>${exp.category}</td>
          <td>₹${parseFloat(exp.amount).toFixed(2)}</td>
          <td>${date}</td>
          <td>
            <div class="act">
              <button data-edit="${exp.id}">Edit</button>
              <button data-del="${exp.id}">Delete</button>
            </div>
          </td>`;
        tbody.appendChild(tr);
      }
      renderPagination(data.total, data.page, data.pageCount);
    }
    tbody.querySelectorAll('button[data-edit]').forEach(btn =>
      btn.addEventListener('click', () => editExpense(btn.dataset.edit))
    );
    tbody.querySelectorAll('button[data-del]').forEach(btn =>
      btn.addEventListener('click', () => deleteExpense(btn.dataset.del))
    );
  }

  function renderPagination(total, current, pages) {
    const containerTop = document.getElementById('pagination');
    const containerBottom = document.getElementById('paginationBottom');
    containerTop.innerHTML = '';
    containerBottom.innerHTML = '';
    const add = (container, p) => {
      const b = document.createElement('button');
      b.textContent = p;
      if (p === current) b.disabled = true;
      b.addEventListener('click', () => { page = p; loadExpenses(); });
      container.appendChild(b);
    };
    for (let p = 1; p <= pages; p++) add(containerTop, p);
    for (let p = 1; p <= pages; p++) add(containerBottom, p);
  }

  async function editExpense(id) {
    const res = await fetch(
      `${window.APP_CONFIG.API_BASE_URL}/api/expenses?id=${id}`,
      { headers: { ...authHeader() } }
    );
    const data = await res.json();
    if (data.success && data.items && data.items[0]) {
      const e = data.items[0];
      document.getElementById('expenseId').value = e.id;
      document.getElementById('description').value = e.description;
      document.getElementById('category').value = e.category;
      document.getElementById('amount').value = e.amount;
      document.getElementById('date').value = new Date(e.date).toISOString().slice(0,10);
      document.getElementById('formMsg').textContent = 'Loaded for editing';
    }
  }

  async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    const res = await fetch(
      `${window.APP_CONFIG.API_BASE_URL}/api/expenses/${id}`,
      { method: 'DELETE', headers: { ...authHeader() } }
    );
    const data = await res.json();
    if (data.success) { await loadExpenses(); await refreshLeaderboard(); }
    else alert(data.message || 'Delete failed.');
  }

  // ------- Leaderboard -------
  async function refreshLeaderboard() {
    if (localStorage.getItem('isPremium') !== '1') return;
    const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}/api/stats/leaderboard`, {
      headers: { ...authHeader() }
    });
    const data = await res.json();
    const ol = document.getElementById('leaderboard');
    ol.innerHTML = '';
    if (data.success && Array.isArray(data.top)) {
      for (const u of data.top) {
        const li = document.createElement('li');
        li.textContent = `${u.username} — ₹${parseFloat(u.total).toFixed(2)}`;
        ol.appendChild(li);
      }
    }
  }

  // ------- Sync premium flag from server -------
  async function syncPremiumFromServer() {
    try {
      const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}/api/auth/me`, {
        headers: { ...authHeader() }
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('isPremium', data.isPremium ? '1' : '0');
        updatePremiumUI(data.isPremium);
        if (data.isPremium) refreshLeaderboard();
      }
    } catch {}
  }

  // Initial loads
  syncPremiumFromServer();
  loadExpenses();
  refreshLeaderboard();

  // Periodic updates
  setInterval(refreshLeaderboard, 10000);
  // Optionally also keep premium flag fresh:
  // setInterval(syncPremiumFromServer, 15000);
});
