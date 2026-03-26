// api/checkout.js — Creates Stripe Checkout Session
// Redirects user to Stripe payment page, then back to success URL

const stripe = require('stripe');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_KEY) return res.status(500).json({ error: 'Stripe not configured' });

  const s = stripe(STRIPE_KEY);
  const { price_id, email, name, ref_code, member_id } = req.body || {};

  if (!price_id || !email) return res.status(400).json({ error: 'price_id and email required' });

  try {
    const session = await s.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: price_id, quantity: 1 }],
      mode: 'payment',
      customer_email: email,
      success_url: 'https://onboarding.sportsbetarbitrage.com/join.html?success=true&email=' + encodeURIComponent(email),
      cancel_url: 'https://onboarding.sportsbetarbitrage.com/join.html?cancelled=true',
      metadata: {
        member_name: name || '',
        ref_code: ref_code || '',
        member_id: member_id || '',
        price_id: price_id
      }
    });

    return res.status(200).json({ success: true, url: session.url, session_id: session.id });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
