
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {   // named export
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ success:false, message:'Missing auth token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, username: payload.username, email: payload.email };
    return next();
  } catch (e) {
    console.error('JWT verify error:', e.message);
    return res.status(401).json({ success:false, message:'Invalid or expired token' });
  }
}
