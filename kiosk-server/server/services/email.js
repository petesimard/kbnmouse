import db from '../db.js';

export async function sendEmail({ to, subject, html }) {
  const apiKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'resend_api_key'").get();
  const fromRow = db.prepare("SELECT value FROM settings WHERE key = 'resend_from_email'").get();

  if (!apiKeyRow?.value) {
    throw new Error('Resend API key not configured. Set it in Dashboard > Settings.');
  }

  const from = fromRow?.value || 'Kiosk <noreply@example.com>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKeyRow.value}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to send email');
  }

  return res.json();
}
