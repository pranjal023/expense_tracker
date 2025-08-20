// cashfree.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

function baseUrl() {
  const env = (process.env.CASHFREE_ENV || 'sandbox').toLowerCase();
  return (env === 'prod' || env === 'production')
    ? 'https://api.cashfree.com'
    : 'https://sandbox.cashfree.com/pg';
}

async function createOrderApi({ orderId, amount, currency = 'INR', returnUrl, customer }) {
  const url = baseUrl() + '/pg/orders';
  const headers = {
    'x-client-id': process.env.CASHFREE_CLIENT_ID || '',
    'x-client-secret': process.env.CASHFREE_CLIENT_SECRET || '',
    'x-api-version': '2022-09-01',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const body = {
    order_id: orderId,
    order_amount: Number(amount),
    order_currency: currency,              // << REQUIRED by Cashfree
    customer_details: {
      customer_id: customer?.id || ('cust_' + orderId.slice(-6)),
      customer_email: customer?.email || 'customer@example.com',
      customer_phone: customer?.phone || '9999999999'
    },
    order_meta: {
      return_url: `${returnUrl}&cf_order_id={order_id}`,
      notify_url: ''                       // optional
    },
    order_note: 'Expense Tracker Premium'
  };

  // No credentials? Fall back to a harmless simulated success for local/demo
  if (!headers['x-client-id'] || !headers['x-client-secret']) {
    return {
      ok: true,
      data: {
        order_id: orderId,
        order_status: 'CREATED',
        // your frontend falls back to payment_link when no session id
        payment_link: `${returnUrl}&simulated=1`
        // (you could also add payment_session_id: 'SIMULATED' if you prefer)
      },
      message: 'Simulated payment link (no Cashfree credentials)'
    };
  }

  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await resp.text();        // better diagnostics
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!resp.ok) {
    // surface exact API error back to your controller
    return {
      ok: false,
      message: data?.message || `Cashfree create order failed (HTTP ${resp.status})`,
      data
    };
  }
  return { ok: true, data };
}

async function fetchOrderApi(orderId) {
  const url = baseUrl() + '/pg/orders/' + encodeURIComponent(orderId);
  const headers = {
    'x-client-id': process.env.CASHFREE_CLIENT_ID || '',
    'x-client-secret': process.env.CASHFREE_CLIENT_SECRET || '',
    'x-api-version': '2022-09-01',
    'Accept': 'application/json'
  };

  if (!headers['x-client-id'] || !headers['x-client-secret']) {
    return { ok: true, data: { order_id: orderId, order_status: 'PAID' } }; // simulated
  }

  const resp = await fetch(url, { headers });
  const text = await resp.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!resp.ok) return { ok: false, message: `Cashfree fetch order failed (HTTP ${resp.status})`, data };
  return { ok: true, data };
}

export async function createCashfreeOrder({ orderId, amount, currency = 'INR', returnUrl, userId }) {
  return await createOrderApi({
    orderId,
    amount,
    currency,                 // << pass it through
    returnUrl,
    customer: { id: 'user_' + userId }
  });
}

export async function fetchCashfreeOrder(orderId) {
  return await fetchOrderApi(orderId);
}
