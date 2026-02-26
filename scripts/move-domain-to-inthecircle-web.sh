#!/usr/bin/env bash
# Move app.inthecircle.co from project "inthecircle" to "inthecircle-web"
# Token: VERCEL_TOKEN env, or from `vercel login` auth file.
set -e
TEAM_ID="team_pPf6WSH38ILGLhFASbKqYYgL"
DOMAIN="app.inthecircle.co"

if [ -z "$VERCEL_TOKEN" ]; then
  VERCEL_TOKEN=$(node -e "
    const fs=require('fs');const path=require('path');const os=require('os');
    const dir=process.platform==='darwin'?path.join(os.homedir(),'Library','Application Support','com.vercel.cli'):path.join(os.homedir(),'.local','share','com.vercel.cli');
    try{const j=JSON.parse(fs.readFileSync(path.join(dir,'auth.json'),'utf8'));if(j.token)process.stdout.write(j.token);}catch(e){}
  ")
fi
if [ -z "$VERCEL_TOKEN" ]; then
  echo "Error: Run  vercel login  first, or set VERCEL_TOKEN (from https://vercel.com/account/tokens)"
  exit 1
fi

echo "Removing $DOMAIN from project inthecircle (if it exists)..."
RESP=$(curl -s -w "\n%{http_code}" -X DELETE "https://api.vercel.com/v9/projects/inthecircle/domains/${DOMAIN}?teamId=${TEAM_ID}" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json")
HTTP_CODE=$(echo "$RESP" | tail -n 1)
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "Auth failed (code $HTTP_CODE). Run  vercel login  again or set VERCEL_TOKEN from https://vercel.com/account/tokens"
  echo "Or fix in Dashboard: https://vercel.com → each project → Settings → Domains → remove app.inthecircle.co from every project except inthecircle-web."
  exit 1
fi

echo ""
echo "Adding $DOMAIN to project inthecircle-web..."
RESP2=$(curl -s -w "\n%{http_code}" -X POST "https://api.vercel.com/v10/projects/inthecircle-web/domains?teamId=${TEAM_ID}" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"${DOMAIN}\"}")
HTTP_CODE2=$(echo "$RESP2" | tail -n 1)
if [ "$HTTP_CODE2" = "401" ] || [ "$HTTP_CODE2" = "403" ]; then
  echo "Auth failed (code $HTTP_CODE2). Run  vercel login  again or use Dashboard to add app.inthecircle.co to inthecircle-web."
  exit 1
fi

echo ""
echo "Done. https://app.inthecircle.co should now point to inthecircle-web. Run: npm run verify-domain"
