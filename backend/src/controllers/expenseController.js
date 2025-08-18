import { pool } from '../config/db.js';

export async function listExpenses(req, res) {
  try {
    const userId = req.user.id;
    const { page=1, limit=10, id } = req.query;
    if (id) {
      const [rows] = await pool.query('SELECT * FROM expenses WHERE id=? AND user_id=?', [id, userId]);
      return res.json({ success:true, items: rows });
    }
    const p = Math.max(1, parseInt(page));
    const l = Math.max(1, Math.min(100, parseInt(limit)));
    const [countRows] = await pool.query('SELECT COUNT(*) AS cnt FROM expenses WHERE user_id=?', [userId]);
    const total = countRows[0].cnt;
    const offset = (p-1)*l;
    const [rows] = await pool.query('SELECT * FROM expenses WHERE user_id=? ORDER BY date DESC, id DESC LIMIT ? OFFSET ?', [userId, l, offset]);
    res.json({ success:true, items: rows, total, page: p, pageCount: Math.ceil(total/l) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Failed to fetch expenses' });
  }
}

export async function createExpense(req, res) {
  try {
    const userId = req.user.id;
    const { description, category, amount, date } = req.body;
    if (!description || !category || !amount || !date) return res.status(400).json({ success:false, message:'Missing fields' });
    await pool.query('INSERT INTO expenses (user_id, description, category, amount, date) VALUES (?,?,?,?,?)', [userId, description, category, amount, date]);
    res.json({ success:true, message:'Created' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Create failed' });
  }
}

export async function updateExpense(req, res) {
  try {
    const userId = req.user.id;
    const id = req.params.id;
    const { description, category, amount, date } = req.body;
    const [rows] = await pool.query('SELECT * FROM expenses WHERE id=? AND user_id=?', [id, userId]);
    if (!rows.length) return res.status(404).json({ success:false, message:'Not found' });
    await pool.query('UPDATE expenses SET description=?, category=?, amount=?, date=? WHERE id=?', [description, category, amount, date, id]);
    res.json({ success:true, message:'Updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Update failed' });
  }
}

export async function deleteExpense(req, res) {
  try {
    const userId = req.user.id;
    const id = req.params.id;
    const [rows] = await pool.query('SELECT * FROM expenses WHERE id=? AND user_id=?', [id, userId]);
    if (!rows.length) return res.status(404).json({ success:false, message:'Not found' });
    await pool.query('DELETE FROM expenses WHERE id=?', [id]);
    res.json({ success:true, message:'Deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Delete failed' });
  }
}
