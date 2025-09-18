
const isProd = location.hostname.endsWith('netlify.app') || location.hostname.endsWith('yourdomain.com');
window.APP_CONFIG = {
  API_BASE_URL: isProd
    ? "https://expense-tracker-ijex.onrender.com"
    : "http://localhost:3000"
};
