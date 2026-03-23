export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const VPN_TOKEN = process.env.VPN_RESELLER_TOKEN;
  
  if (!VPN_TOKEN) {
    return res.status(500).json({ error: 'VPN API not configured' });
  }

  try {
    // Create VPN account
    const response = await fetch('https://api.vpnresellers.com/v3/accounts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VPN_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.message || 'VPN creation failed',
        details: data 
      });
    }

    return res.status(200).json({ 
      success: true, 
      vpn_username: username,
      vpn_id: data.data?.id 
    });
  } catch (error) {
    console.error('VPN API error:', error);
    return res.status(500).json({ error: 'Failed to create VPN account' });
  }
}
