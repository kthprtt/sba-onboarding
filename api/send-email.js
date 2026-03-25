// api/send-email.js — Vercel Serverless Function
// Sends welcome emails via Resend

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { to, subject, body } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing to, subject, or body' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    return res.status(500).json({ 
      success: false, 
      error: 'Resend API key not configured. Add RESEND_API_KEY to Vercel environment variables.' 
    });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SBA Genius <welcome@sportsbetarbitrage.com>',
        to: [to],
        subject: subject,
        text: body,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return res.status(200).json({ success: true, id: data.id });
    } else {
      return res.status(400).json({ success: false, error: data.message || 'Send failed' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
