import { NextResponse } from 'next/server'

/**
 * Handles Airtable OAuth callback and redirects to the iOS app.
 * 
 * Flow:
 * 1. iOS app initiates OAuth with Airtable using this HTTPS URL as redirect_uri
 * 2. Airtable redirects here with ?code=xxx after user authorizes
 * 3. This route redirects to inthecircle://auth/airtable?code=xxx
 * 4. iOS app's ASWebAuthenticationSession captures the custom URL scheme
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  // Get all query parameters from Airtable's callback
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  
  // Build the iOS app deep link URL
  const appScheme = 'inthecircle'
  const appPath = 'auth/airtable'
  
  // Construct query string with all parameters
  const params = new URLSearchParams()
  if (code) params.set('code', code)
  if (state) params.set('state', state)
  if (error) params.set('error', error)
  if (errorDescription) params.set('error_description', errorDescription)
  
  const appUrl = `${appScheme}://${appPath}?${params.toString()}`
  
  // Return an HTML page that redirects to the app
  // This is more reliable than a 302 redirect for custom URL schemes
  const html = `
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
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: #7c3aed;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1.5rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    p {
      color: rgba(255,255,255,0.7);
      margin-bottom: 1.5rem;
    }
    .button {
      display: inline-block;
      background: #7c3aed;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
    }
    .button:hover {
      background: #6d28d9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Connecting to Airtable</h1>
    <p>Redirecting you back to the app...</p>
    <a href="${appUrl}" class="button">Open In The Circle App</a>
  </div>
  <script>
    // Automatically redirect to the app
    window.location.href = "${appUrl}";
    
    // Fallback: try again after a short delay
    setTimeout(function() {
      window.location.href = "${appUrl}";
    }, 500);
  </script>
</body>
</html>
`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  })
}
