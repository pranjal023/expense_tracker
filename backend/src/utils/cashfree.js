import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

function baseUrl() {
  const env = (process.env.CASHFREE_ENV || 'sandbox').toLowerCase();
  return env === 'prod' || env === 'production' ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com';
}

async function createOrderApi({ orderId, amount,  returnUrl, customer }) {
  const url = baseUrl() + '/pg/orders';
  const headers = {
    'x-client-id': process.env.CASHFREE_CLIENT_ID || '',
    'x-client-secret': process.env.CASHFREE_CLIENT_SECRET || '',
    'x-api-version': '2022-09-01',
    'Content-Type': 'application/json'
  };
  const body = {
    order_id: orderId,
    order_amount: Number(amount),
    
    customer_details: {
      customer_id: customer?.id || 'cust_' + orderId.slice(-6),
      customer_email: customer?.email || 'customer@example.com',
      customer_phone: customer?.phone || '9999999999'
    },
    order_meta: {
      return_url: returnUrl + '&cf_order_id={order_id}',
      notify_url: '' 
    },
    order_note: 'Expense Tracker Premium'
  };

  
  if (!headers['x-client-id'] || !headers['x-client-secret']) {
    return {
      ok: true,
      data: {
        order_id: orderId,
        order_status: 'CREATED',
        payment_link: returnUrl.replace('payment-result', 'payment-result') + '&simulated=1'
      },
      message: 'Simulated payment link (no Cashfree credentials)'
    };
  }

  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await resp.json().catch(()=> ({}));
  if (!resp.ok) {
    return { ok:false, message: data?.message || 'Cashfree create order failed', data };
  }
  return { ok: true, data };
}

async function fetchOrderApi(orderId) {
  const url = baseUrl() + '/pg/orders/' + encodeURIComponent(orderId);
  const headers = {
    'x-client-id': process.env.CASHFREE_CLIENT_ID || '',
    'x-client-secret': process.env.CASHFREE_CLIENT_SECRET || '',
    'x-api-version': '2022-09-01',
    'Content-Type': 'application/json'
  };
  if (!headers['x-client-id'] || !headers['x-client-secret']) {
    
    return { ok: true, data: { order_id: orderId, order_status: 'PAID' } };
  }
  const resp = await fetch(url, { headers });
  const data = await resp.json().catch(()=> ({}));
  if (!resp.ok) return { ok: false, message: 'Cashfree fetch order failed', data };
  return { ok :true, data };
}

export async function createCashfreeOrder({ orderId, amount,  returnUrl, userId }) {
  
  return await createOrderApi({ orderId, amount, returnUrl, customer: { id: 'user_'+userId } });
}

export async function fetchCashfreeOrder(orderId) {
  return await fetchOrderApi(orderId);
}
