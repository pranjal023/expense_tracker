import { pool } from '../config/db.js';

export async function leaderboard(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT u.username, ROUND(SUM(e.amount),2) AS total
      FROM users u
      JOIN expenses e ON e.user_id = u.id
      GROUP BY u.id
      ORDER BY total DESC
      LIMIT 5
    `);
    res.json({ success:true, top: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Failed to fetch leaderboard' });
  }
}
