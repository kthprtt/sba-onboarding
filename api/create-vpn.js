// api/create-vpn.js — Vercel Serverless Function
// Auto-provisions VPN accounts via VPNResellers API v3

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { username, password, member_id } = req.body || {};
  const VPN_TOKEN = process.env.VPN_RESELLER_TOKEN;
  const SUPABASE_URL = 'https://anjlmooskwvjystmrhxr.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!VPN_TOKEN) {
    return res.status(500).json({ success: false, error: 'VPN_RESELLER_TOKEN not configured' });
  }

  const vpnUsername = username || ('sba_' + Math.random().toString(36).substring(2, 10));
  const vpnPassword = password || ('SBA-VPN-' + Math.random().toString(36).substring(2, 8).toUpperCase());

  try {
    const createRes = await fetch('https://api.vpnresellers.com/v3/accounts', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + VPN_TOKEN,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: vpnUsername, password: vpnPassword })
    });

    const createData = await createRes.json();
    console.log('VPNResellers response:', createRes.status, JSON.stringify(createData));

    if (createRes.status === 201 || createRes.status === 200) {
      // Update Supabase
      if (member_id && SUPABASE_KEY) {
        await fetch(SUPABASE_URL + '/rest/v1/onboarding_members?id=eq.' + member_id, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            vpn_username: vpnUsername,
            vpn_password: vpnPassword,
            vpn_status: 'provisioned',
            vpn: true
          })
        });
      }

      return res.status(200).json({
        success: true,
        vpn_id: createData.data && createData.data.id,
        username: vpnUsername,
        password: vpnPassword,
        status: 'Active'
      });
    } else if (createRes.status === 422) {
      // Username taken — retry
      const alt = 'sba_' + Math.random().toString(36).substring(2, 10);
      const retry = await fetch('https://api.vpnresellers.com/v3/accounts', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + VPN_TOKEN, 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: alt, password: vpnPassword })
      });
      const retryData = await retry.json();
      if (retry.status === 201 || retry.status === 200) {
        return res.status(200).json({ success: true, username: alt, password: vpnPassword, status: 'Active' });
      }
      return res.status(400).json({ success: false, error: 'Username conflict', details: retryData });
    } else if (createRes.status === 402) {
      return res.status(402).json({ success: false, error: 'Insufficient VPN balance' });
    } else {
      return res.status(400).json({ success: false, error: createData.message || 'VPN creation failed', status: createRes.status, details: createData });
    }
  } catch (error) {
    console.error('VPN create error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
// redeployed Wed Mar 25 16:30:55 UTC 2026
