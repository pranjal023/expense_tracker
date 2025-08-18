import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { sendEmail } from '../utils/sendEmail.js';

dotenv.config();

export async function signup(req, res) {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ success:false, message:'Missing fields' });
    const [exists] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
    if (exists.length) return res.status(400).json({ success:false, message:'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, email, password_hash) VALUES (?,?,?)', [username, email, hash]);
    res.json({ success:true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Signup failed' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
    if (!rows.length) return res.status(401).json({ success:false, message:'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ success:false, message:'Invalid credentials' });
    const token = jwt.sign({ id:user.id, email:user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ success:true, token, username: user.username, isPremium: !!user.is_premium });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Login failed' });
  }
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
    if (!rows.length) return res.json({ success:true, message:'If the email exists, a reset link will be sent.' });
    const user = rows[0];
    const token = crypto.randomBytes(20).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 1000*60*30); // 30 minutes
    await pool.query('DELETE FROM password_resets WHERE user_id=?', [user.id]);
    await pool.query('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?,?)', [user.id, tokenHash, expiresAt]);

    const resetLink = (process.env.FRONTEND_BASE_URL || 'http://localhost:5500/frontend') + '/reset.html?token=' + encodeURIComponent(token);
    await sendEmail({
      to: email,
      subject: 'Reset your password',
      html: `<p>Hello ${user.username},</p><p>Click the link below to reset your password (valid for 30 minutes):</p><p><a href="${resetLink}">${resetLink}</a></p>`
    });

    res.json({ success:true, message:'Reset link sent if the email exists.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Failed to send reset link' });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success:false, message:'Missing fields' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query('SELECT * FROM password_resets WHERE token_hash=? AND expires_at > NOW()', [tokenHash]);
    if (!rows.length) return res.status(400).json({ success:false, message:'Invalid or expired token' });
    const reset = rows[0];
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, reset.user_id]);
    await pool.query('DELETE FROM password_resets WHERE id=?', [reset.id]);
    res.json({ success:true, message:'Password updated. You can log in now.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Reset failed' });
  }
}


export async function me(req, res) {
  try {
    const [rows] = await pool.query('SELECT username, is_premium FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ success:false, message:'User not found' });
    res.json({ success:true, username: rows[0].username, isPremium: !!rows[0].is_premium });
  } catch (e) {
    res.status(500).json({ success:false, message:'Failed to fetch profile' });
  }
}
