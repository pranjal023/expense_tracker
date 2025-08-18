export function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}
export function requireAuth() {
  const token = localStorage.getItem('token');
  if (!token) window.location.href = './index.html';
}
export function setUserBadge(isPremium) {
  const badge = document.getElementById('userBadge');
  if (badge) {
    badge.textContent = isPremium ? 'Premium' : 'Free';
    badge.style.background = isPremium ? '#fde047' : '#0ea5e9';
  }
}
