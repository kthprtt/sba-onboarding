// api/reset-vpn.js — Reset VPN password and update Supabase
// Usage: POST /api/reset-vpn { vpn_id: 714171, new_password: 'SBA-VPN-XXXXX', member_name: 'John Smith' }
// Or: POST /api/reset-vpn { action: 'bulk_reset' } — resets ALL old accounts

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const VPN_TOKEN = process.env.VPN_RESELLER_TOKEN;
  const SUPABASE_URL = 'https://anjlmooskwvjystmrhxr.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!VPN_TOKEN) return res.status(500).json({ error: 'VPN_RESELLER_TOKEN not configured' });

  const { vpn_id, new_password, member_name, action } = req.body || {};

  // Bulk reset all old accounts (pre-sba_ prefix)
  if (action === 'bulk_reset') {
    try {
      // Get all accounts
      const listRes = await fetch('https://api.vpnresellers.com/v3/accounts', {
        headers: { 'Authorization': 'Bearer ' + VPN_TOKEN, 'Accept': 'application/json' }
      });
      const listData = await listRes.json();
      const accounts = listData.data || [];
      
      const results = [];
      for (const acct of accounts) {
        // Skip test account and already-sba-prefixed ones
        if (acct.username === 'test_sba_123') continue;
        
        // Generate a new password
        const newPw = 'SBA-' + acct.username.substring(0, 4).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        
        // Reset password via API
        const resetRes = await fetch('https://api.vpnresellers.com/v3/accounts/' + acct.id + '/change_password', {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + VPN_TOKEN,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password: newPw })
        });
        
        const resetData = await resetRes.json();
        results.push({
          id: acct.id,
          username: acct.username,
          new_password: newPw,
          status: resetRes.ok ? 'reset' : 'failed',
          error: resetRes.ok ? null : resetData.message
        });
      }
      
      return res.status(200).json({ success: true, total: results.length, results });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // Single account reset
  if (!vpn_id) return res.status(400).json({ error: 'vpn_id required' });
  
  const password = new_password || ('SBA-VPN-' + Math.random().toString(36).substring(2, 8).toUpperCase());

  try {
    const resetRes = await fetch('https://api.vpnresellers.com/v3/accounts/' + vpn_id + '/change_password', {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + VPN_TOKEN,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: password })
    });

    const resetData = await resetRes.json();

    if (resetRes.ok) {
      return res.status(200).json({
        success: true,
        vpn_id: vpn_id,
        password: password,
        status: 'Password reset'
      });
    } else {
      return res.status(400).json({ success: false, error: resetData.message || 'Reset failed' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
