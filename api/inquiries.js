const inMemoryInquiries = [];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const allocationId = 'ALLOC-' + Math.random().toString(36).substring(2, 9).toUpperCase();
        const record = {
          id: allocationId,
          name: payload.name || 'Anonymous',
          email: payload.email || 'N/A',
          profile: payload.profile || 'General Validation',
          timestamp: new Date().toISOString(),
          status: 'CONFIRMED_BATCH_01'
        };

        inMemoryInquiries.unshift(record);

        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          allocationId: record.id,
          status: record.status,
          message: 'Reservation recorded. Priority confirmation registered.'
        }));
      } catch {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  if (req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(inMemoryInquiries, null, 2));
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
}
