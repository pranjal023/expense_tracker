import { authHeader, requireAuth, setUserBadge } from './util.js';

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  const btnLogout = document.getElementById('btnLogout');
  const btnExport = document.getElementById('btnExport');
  const btnUpgrade = document.getElementById('btnUpgrade');
  const form = document.getElementById('expenseForm');
  const btnClear = document.getElementById('btnClear');
  const perPageSelect = document.getElementById('perPage');
  
const leaderboardSection = document.getElementById('leaderboardSection');

const dateEl = document.getElementById('date');
if (dateEl) {
  const openPicker = () => dateEl.showPicker && dateEl.showPicker();
  dateEl.addEventListener('focus', openPicker);
  dateEl.addEventListener('click', openPicker);
  dateEl.addEventListener('keydown', (e) => {
    
    if (!['Tab','Shift','Escape','Enter'].includes(e.key)) openPicker();
  });
}


function updatePremiumUI(isPremium) {
  setUserBadge(isPremium);
  btnExport.disabled = !isPremium;
  if (leaderboardSection) {
    leaderboardSection.style.display = isPremium ? '' : 'none';
  }
}

  let page = 1;
  let limit = parseInt(perPageSelect.value, 10);

  const isPremium = localStorage.getItem('isPremium') === '1';
  setUserBadge(isPremium);
  btnExport.disabled = !isPremium;

  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('isPremium');
    window.location.href = './index.html';
  });
btnUpgrade.addEventListener('click', async () => {
  try {
    const tokenHeader = authHeader();
    const res = await fetch(window.APP_CONFIG.API_BASE_URL + '/api/subscription/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...tokenHeader },
      body: JSON.stringify({ plan: 'premium_199', amount: 199.00, currency: 'INR' }),
    });
    const data = await res.json();

    if (!data.success) {
      alert(data.message || 'Failed to start payment.');
      return;
    }

    if (data.payment_session_id && window.Cashfree) {
      const mode = 'sandbox'; 
      const cashfree = window.Cashfree({ mode });

  
      await cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        
      });

    
      return;
    }

    
    if (data.payment_link) {
      window.location.href = data.payment_link;
      return;
    }

    alert('Payment init failed (no session id / payment link).');
  } catch (e) {
    console.error(e);
    alert('Error starting payment.');
  }
});


  btnExport.addEventListener('click', async () => {
    const tokenHeader = authHeader();
    const res = await fetch(window.APP_CONFIG.API_BASE_URL + '/api/export/csv', {
      headers: { ...tokenHeader },
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

  perPageSelect.addEventListener('change', () => {
    limit = parseInt(perPageSelect.value, 10);
    page = 1;
    loadExpenses();
  });

  btnClear.addEventListener('click', () => {
    form.reset();
    document.getElementById('expenseId').value = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('expenseId').value;
    const payload = {
      description: document.getElementById('description').value.trim(),
      category: document.getElementById('category').value.trim(),
      amount: parseFloat(document.getElementById('amount').value),
      date: document.getElementById('date').value
    };
    const tokenHeader = authHeader();
    const url = window.APP_CONFIG.API_BASE_URL + '/api/expenses' + (id ? '/' + id : '');
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json', ...tokenHeader }, body: JSON.stringify(payload)
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

  async function loadExpenses() {
    const tokenHeader = authHeader();
    const res = await fetch(window.APP_CONFIG.API_BASE_URL + `/api/expenses?page=${page}&limit=${limit}`, {
      headers: { ...tokenHeader }
    });
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
    
    tbody.querySelectorAll('button[data-edit]').forEach(btn => btn.addEventListener('click', () => editExpense(btn.dataset.edit)));
    tbody.querySelectorAll('button[data-del]').forEach(btn => btn.addEventListener('click', () => deleteExpense(btn.dataset.del)));
  }

  function renderPagination(total, current, pages) {
    const containerTop = document.getElementById('pagination');
    const containerBottom = document.getElementById('paginationBottom');
    containerTop.innerHTML = '';
    containerBottom.innerHTML = '';
    function add(container, p) {
      const b = document.createElement('button');
      b.textContent = p;
      if (p === current) b.disabled = true;
      b.addEventListener('click', () => { page = p; loadExpenses(); });
      container.appendChild(b);
    }
    for (let p = 1; p <= pages; p++) add(containerTop, p);
    for (let p = 1; p <= pages; p++) add(containerBottom, p);
  }

  async function editExpense(id) {
    const tokenHeader = authHeader();
    const res = await fetch(window.APP_CONFIG.API_BASE_URL + '/api/expenses?id=' + id, { headers: { ...tokenHeader } });
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
    const tokenHeader = authHeader();
    const res = await fetch(window.APP_CONFIG.API_BASE_URL + '/api/expenses/' + id, {
      method: 'DELETE', headers: { ...tokenHeader }
    });
    const data = await res.json();
    if (data.success) { await loadExpenses(); await refreshLeaderboard(); }
    else alert(data.message || 'Delete failed.');
  }

async function refreshLeaderboard() {
  
  if (localStorage.getItem('isPremium') !== '1') return;

  const res = await fetch(window.APP_CONFIG.API_BASE_URL + '/api/stats/leaderboard', {
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


  async function syncPremiumFromServer() {
  try {
    const res = await fetch(window.APP_CONFIG.API_BASE_URL + '/api/auth/me', {
      headers: { ...authHeader() }
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('isPremium', data.isPremium ? '1' : '0');
      setUserBadge(data.isPremium);
      btnExport.disabled = !data.isPremium;
    }
  } catch {}
}



  
  syncPremiumFromServer();
  loadExpenses();
  refreshLeaderboard();
  setInterval(refreshLeaderboard, 10000);
});
