import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { pool } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import exportRoutes from './routes/exportRoutes.js';

dotenv.config();

const app = express();

/* ---------- CORS (single block, first) ---------- */
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // allow curl/postman
    if (!allowedOrigins.length || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
/* ----------------------------------------------- */

/* If you need raw body for Cashfree, put this route
   BEFORE the global JSON parser so raw body is available. */
app.post('/api/subscription/cashfree-webhook', express.raw({ type: '*/*' }), async (req,res) => {
  try {
    const body = req.body.toString('utf8');
    const data = JSON.parse(body);
    const orderId = data?.data?.order?.order_id || data?.order?.order_id || data?.order_id;
    const status  = data?.data?.payment?.payment_status || data?.payment_status || data?.status;

    if (orderId && status) {
      const [rows] = await pool.query('SELECT * FROM orders WHERE order_id=?', [orderId]);
      if (rows.length) {
        await pool.query('UPDATE orders SET status=? WHERE order_id=?', [status.toUpperCase(), orderId]);
        if (['PAID','SUCCESS'].includes(status.toUpperCase())) {
          await pool.query('UPDATE users SET is_premium=1 WHERE id=?', [rows[0].user_id]);
        }
      }
    }
    res.json({ success: true });
  } catch (e) {
    console.error('webhook error', e);
    res.status(400).json({ success:false });
  }
});

/* Global parsers AFTER the webhook */
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1+1 AS two');
    res.json({ success: true, status: 'ok' });
  } catch {
    res.status(500).json({ success: false, message: 'DB error' });
  }
});

/* Routes */
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/export', exportRoutes);

/* Listen */
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('Server listening on ' + PORT));
