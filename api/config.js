// Expose Supabase URL and anon key to the client (from Vercel env).
// Used by signup.html when config.js is missing or has placeholders.
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  var url = process.env.SUPABASE_URL || '';
  var key = process.env.SUPABASE_ANON_KEY || '';
  res.status(200).send(JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }));
};
