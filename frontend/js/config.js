
const isProd = location.hostname.endsWith('netlify.app') || location.hostname.endsWith('yourdomain.com');
window.APP_CONFIG = {
  API_BASE_URL: isProd
    ? "http://expensetracker-production-3265.up.railway.app"
    : "http://localhost:3000"
};
