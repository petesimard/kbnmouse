import { getSetting } from '../db.js';

export async function sendEmail({ to, subject, html, accountId }) {
  const apiKey = getSetting('resend_api_key', accountId);
  const from = getSetting('resend_from_email', accountId) || 'Kiosk <noreply@example.com>';

  if (!apiKey) {
    throw new Error('Resend API key not configured. Set it in Dashboard > Settings.');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
