// controllers/subscriptionController.js
import { pool } from '../config/db.js';
import { createCashfreeOrder, fetchCashfreeOrder } from '../utils/cashfree.js';
import { v4 as uuid } from 'uuid';

export async function createOrder(req, res) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const userId = req.user.id;
    const { amount = 199.00, currency = 'INR' } = req.body ?? {};

    // basic validation
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const orderId = 'ord_' + uuid().replace(/-/g, '').slice(0, 18);
    const returnUrl =
      (process.env.FRONTEND_BASE_URL || 'http://localhost:5500/frontend') +
      '/payment-result.html?order_id=' + orderId;

    // create DB record first
    await pool.query(
      'INSERT INTO orders (user_id, order_id, amount, status) VALUES (?, ?, ?, ?)',
      [userId, orderId, amt, 'CREATED']
    );

    // create order with Cashfree
    const resp = await createCashfreeOrder({
      orderId,
      amount: amt,
      currency,         // cashfree.js will map this to order_currency
      returnUrl,
      userId
    });

    if (!resp?.ok) {
      // mark the order as failed so you can see it in DB
      try {
        await pool.query('UPDATE orders SET status=? WHERE order_id=?', ['FAILED', orderId]);
      } catch {}
      console.error('Cashfree create order failed:', resp);
      return res.status(502).json({
        success: false,
        message: resp?.message || 'Cashfree order failed',
        details: resp?.data ?? null
      });
    }

    const cfStatus = resp.data?.order_status
      ? String(resp.data.order_status).toUpperCase()
      : 'CREATED';

    await pool.query('UPDATE orders SET status=? WHERE order_id=?', [cfStatus, orderId]);

    return res.json({
      success: true,
      order_id: orderId,
      order_status: cfStatus,
      payment_session_id: resp.data?.payment_session_id || null,
      payment_link: resp.data?.payment_link || null
    });
  } catch (e) {
    console.error('createOrder error:', e);
    return res.status(500).json({ success: false, message: 'Failed to create order' });
  }
}

export async function getStatus(req, res) {
  try {
    const { order_id } = req.query;
    if (!order_id) {
      return res.status(400).json({ success: false, message: 'Missing order_id' });
    }

    const [rows] = await pool.query('SELECT * FROM orders WHERE order_id=?', [order_id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const row = rows[0];
    let status = String(row.status || '').toUpperCase();

    // If not final, try to sync with Cashfree
    if (!['PAID', 'SUCCESS', 'FAILED', 'VOID'].includes(status)) {
      const resp = await fetchCashfreeOrder(order_id);
      if (resp.ok && resp.data?.order_status) {
        status = String(resp.data.order_status).toUpperCase();
        await pool.query('UPDATE orders SET status=? WHERE order_id=?', [status, order_id]);

        if (status === 'PAID' || status === 'SUCCESS') {
          await pool.query('UPDATE users SET is_premium=1 WHERE id=?', [row.user_id]);
        }
      }
    }

    return res.json({ success: true, status });
  } catch (e) {
    console.error('getStatus error:', e);
    return res.status(500).json({ success: false, message: 'Failed to get status' });
  }
}
