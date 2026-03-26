// api/list-vpn.js — List all VPN accounts from VPNResellers

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const VPN_TOKEN = process.env.VPN_RESELLER_TOKEN;
  if (!VPN_TOKEN) return res.status(500).json({ error: 'VPN_RESELLER_TOKEN not configured' });

  try {
    let all = [];
    let page = 1;
    let lastPage = 1;
    
    while (page <= lastPage) {
      const r = await fetch('https://api.vpnresellers.com/v3/accounts?page=' + page, {
        headers: { 'Authorization': 'Bearer ' + VPN_TOKEN, 'Accept': 'application/json' }
      });
      const data = await r.json();
      if (data.data) all = all.concat(data.data);
      lastPage = data.meta?.last_page || 1;
      page++;
    }

    return res.status(200).json({ success: true, total: all.length, accounts: all });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
