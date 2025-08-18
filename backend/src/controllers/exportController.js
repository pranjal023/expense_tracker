import { pool } from '../config/db.js';
import { stringify } from 'csv-stringify';

export async function exportCsv(req, res) {
  try {
    const userId = req.user.id;
    const [urows] = await pool.query('SELECT is_premium FROM users WHERE id=?', [userId]);
    if (!urows.length || !urows[0].is_premium) {
      return res.status(403).json({ success:false, message:'Premium required' });
    }
    const [rows] = await pool.query('SELECT description, category, amount, date FROM expenses WHERE user_id=? ORDER BY date DESC, id DESC', [userId]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
    const stringifier = stringify({ header: true, columns: ['description','category','amount','date'] });
    rows.forEach(r => stringifier.write([r.description, r.category, r.amount, r.date]));
    stringifier.end();
    stringifier.pipe(res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Export failed' });
  }
}
