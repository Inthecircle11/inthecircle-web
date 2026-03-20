// Notion OAuth callback handler.
// Notion redirects here (GET) with ?code=...&state=... or ?error=...; we redirect to inthecircle://
// No OAuth logic — route exists so the rewrite does not 404. Redirect only.

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function safeEncode(s) {
  if (s == null || s === '') return '';
  try {
    return encodeURIComponent(String(s));
  } catch (e) {
    return '';
  }
}

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }

  var query = req.query || {};
  var code = query.code;
  var state = query.state;
  var error = query.error;
  var errorDescription = query.error_description;

  var baseUrl = 'inthecircle://notion/callback';

  if (error) {
    var errorMessage = (errorDescription || error || 'Unknown error').toString();
    var appUrl = baseUrl + '?error=' + safeEncode(errorMessage);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notion connection</title></head><body style="font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#000;color:#fff;text-align:center;padding:20px">' +
      '<h1>Connection failed</h1><p>' + escapeHtml(errorMessage) + '</p>' +
      '<a href="' + escapeHtml(appUrl) + '" style="display:inline-block;padding:14px 28px;background:#fff;color:#000;text-decoration:none;border-radius:12px;font-weight:600">Return to App</a>' +
      '<script>setTimeout(function(){ window.location.href = "' + escapeHtml(appUrl) + '"; }, 1000);</script></body></html>'
    );
  }

  if (!code || typeof code !== 'string' || code.trim() === '') {
    var errMsg = 'Missing authorization code. Please try connecting again.';
    var errUrl = baseUrl + '?error=' + safeEncode(errMsg);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notion connection</title></head><body style="font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#000;color:#fff;text-align:center;padding:20px">' +
      '<h1>Connection issue</h1><p>' + escapeHtml(errMsg) + '</p>' +
      '<a href="' + escapeHtml(errUrl) + '" style="display:inline-block;padding:14px 28px;background:#fff;color:#000;text-decoration:none;border-radius:12px;font-weight:600">Return to App</a>' +
      '<script>setTimeout(function(){ window.location.href = "' + escapeHtml(errUrl) + '"; }, 1500);</script></body></html>'
    );
  }

  var appUrl = baseUrl + '?code=' + safeEncode(code.trim());
  if (state != null && String(state).trim() !== '') {
    appUrl += '&state=' + safeEncode(String(state).trim());
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connecting to Notion...</title></head><body style="font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#000;color:#fff;text-align:center;padding:20px">' +
    '<p>Redirecting you back to the app...</p>' +
    '<a href="' + escapeHtml(appUrl) + '" style="display:inline-block;padding:14px 28px;background:#fff;color:#000;text-decoration:none;border-radius:12px;font-weight:600">Open App</a>' +
    '<script>window.location.href = "' + escapeHtml(appUrl) + '";</script></body></html>'
  );
};
