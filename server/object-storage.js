const https = require('https');

function request(options, body) { return new Promise((resolve, reject) => { const req = https.request(options, res => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => res.statusCode >= 200 && res.statusCode < 300 ? resolve(data) : reject(new Error(`Object storage returned ${res.statusCode}`))); }); req.on('error', reject); req.end(body); }); }
async function uploadAvatar(filename, bytes, contentType) {
  const base = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'avatars';
  if (!base || !key) return null;
  const url = new URL(`/storage/v1/object/${bucket}/${filename}`, base);
  await request({ hostname: url.hostname, port: url.port || 443, path: `${url.pathname}${url.search}`, method: 'POST', headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': contentType, 'Content-Length': bytes.length, 'x-upsert': 'true' } }, bytes);
  return process.env.SUPABASE_STORAGE_PUBLIC === '1' ? `${base.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${filename}` : `storage://${bucket}/${filename}`;
}
module.exports = { uploadAvatar };
