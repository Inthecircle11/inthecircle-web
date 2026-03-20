// Airtable OAuth Callback Handler
// Airtable redirects here (GET) with ?code=...&state=...; we return HTML that redirects to inthecircle://

// Escape HTML to prevent XSS attacks
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }
  const { code, state, error, error_description } = req.query || {};

  // Handle errors from Airtable
  if (error) {
    const errorMessage = error_description || error;
    // Redirect to app with error
    const appUrl = `inthecircle://airtable/callback?error=${encodeURIComponent(errorMessage)}`;
    
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Airtable Connection Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              background: #000;
              color: #fff;
              text-align: center;
            }
            h1 { font-size: 24px; margin-bottom: 16px; }
            p { color: #888; margin-bottom: 24px; }
            a {
              display: inline-block;
              padding: 14px 28px;
              background: #fff;
              color: #000;
              text-decoration: none;
              border-radius: 12px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <h1>Connection Failed</h1>
          <p>${escapeHtml(errorMessage)}</p>
          <a href="${escapeHtml(appUrl)}">Return to App</a>
          <script>
            // Auto-redirect after a short delay
            setTimeout(() => { window.location.href = "${escapeHtml(appUrl)}"; }, 1000);
          </script>
        </body>
      </html>
    `);
  }

  // Validate required parameters — redirect to app with error so user sees it in-app
  if (!code) {
    const errorMessage = 'Missing authorization code. Please try connecting again.';
    const appUrl = `inthecircle://airtable/callback?error=${encodeURIComponent(errorMessage)}`;
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Airtable Connection</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              background: #000;
              color: #fff;
              text-align: center;
            }
            p { color: #888; margin-bottom: 24px; }
            a {
              display: inline-block;
              padding: 14px 28px;
              background: #fff;
              color: #000;
              text-decoration: none;
              border-radius: 12px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <h1>Connection issue</h1>
          <p>${escapeHtml(errorMessage)}</p>
          <a href="${escapeHtml(appUrl)}">Return to App</a>
          <script>setTimeout(function(){ window.location.href = "${escapeHtml(appUrl)}"; }, 1500);</script>
        </body>
      </html>
    `);
  }

  // Build the app redirect URL with all parameters
  let appUrl = `inthecircle://airtable/callback?code=${encodeURIComponent(code)}`;
  if (state) {
    appUrl += `&state=${encodeURIComponent(state)}`;
  }

  // Return HTML that redirects to the app
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Connecting to Airtable...</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            background: #000;
            color: #fff;
            text-align: center;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 8px;
          }
          p {
            color: #888;
            margin-bottom: 24px;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #333;
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 24px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          a {
            display: inline-block;
            padding: 14px 28px;
            background: #fff;
            color: #000;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="spinner"></div>
        <h1>Connecting to Airtable</h1>
        <p>Redirecting you back to the app...</p>
        <a href="${escapeHtml(appUrl)}">Open Inthecircle App</a>
        <script>
          // Immediately try to redirect to the app
          window.location.href = "${escapeHtml(appUrl)}";
        </script>
      </body>
    </html>
  `);
}
