import { pool } from '../config/db.js';

export async function requirePremium(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT is_premium FROM users WHERE id=?', [req.user.id]);
    if (!rows.length || !rows[0].is_premium) {
      return res.status(403).json({ success:false, message:'Premium required' });
    }
    next();
  } catch (e) {
    res.status(500).json({ success:false, message:'Premium check failed' });
  }
}
