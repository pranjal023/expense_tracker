import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

export async function sendEmail({ to, subject, html }) {
  if (!process.env.SENDINBLUE_API_KEY) {
    console.warn('SENDINBLUE_API_KEY missing: simulating email to', to);
    return { simulated: true };
  }
  const payload = {
    sender: { email: process.env.FROM_EMAIL || 'no-reply@example.com' },
    to: [{ email: to }],
    subject,
    htmlContent: html
  };
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.SENDINBLUE_API_KEY,
      'accept': 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) {
    const text = await resp.text();
    console.error('Sendinblue error:', resp.status, text);
    throw new Error('Failed to send email');
  }
  return await resp.json();
}
