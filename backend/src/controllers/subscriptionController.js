import { pool } from '../config/db.js';
import { createCashfreeOrder, fetchCashfreeOrder } from '../utils/cashfree.js';
import { v4 as uuid } from 'uuid';

export async function createOrder(req, res) {
  try {
    const userId = req.user.id;
    const { amount=199.00, currency='INR' } = req.body || {};
    const orderId = 'ord_' + uuid().replace(/-/g, '').slice(0,18);
    const returnUrl = (process.env.FRONTEND_BASE_URL || 'http://localhost:5500/frontend') + '/payment-result.html?order_id=' + orderId;

    // create DB record first
    await pool.query('INSERT INTO orders (user_id, order_id, status, amount, currency) VALUES (?,?,?,?,?)', [userId, orderId, 'CREATED', amount, currency]);

    const resp = await createCashfreeOrder({ orderId, amount, currency, returnUrl, userId });
    if (!resp.ok) {
      return res.status(500).json({ success:false, message: resp.message || 'Cashfree order failed' });
    }
    // store status if present
    if (resp.data?.order_status) {
      await pool.query('UPDATE orders SET status=? WHERE order_id=?', [resp.data.order_status, orderId]);
    }
    res.json({ success:true, order_id: orderId, payment_link: resp.data?.payment_link || null, payment_session_id: resp.data?.payment_session_id || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Failed to create order' });
  }
}

export async function getStatus(req, res) {
  try {
    const { order_id } = req.query;
    if (!order_id) return res.status(400).json({ success:false, message:'Missing order_id' });
    const [rows] = await pool.query('SELECT * FROM orders WHERE order_id=?', [order_id]);
    if (!rows.length) return res.status(404).json({ success:false, message:'Order not found' });
    let status = rows[0].status;
    // If still pending, try to fetch from Cashfree
    if (status !== 'PAID' && status !== 'SUCCESS') {
      const resp = await fetchCashfreeOrder(order_id);
      if (resp.ok && resp.data?.order_status) {
        status = resp.data.order_status.toUpperCase();
        await pool.query('UPDATE orders SET status=? WHERE order_id=?', [status, order_id]);
        if (status === 'PAID' || status === 'SUCCESS') {
          await pool.query('UPDATE users SET is_premium=1 WHERE id=?', [rows[0].user_id]);
        }
      }
    }
    res.json({ success:true, status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Failed to get status' });
  }
}
