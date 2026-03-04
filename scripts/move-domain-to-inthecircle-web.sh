#!/usr/bin/env bash
# Move app.inthecircle.co to the configured Vercel project (default: inthecircle-web).
# For "inthecircle web v2" set: VERCEL_PROJECT_NAME=inthecircle-web-v2 (or the exact project name/slug in Vercel).
# Token: VERCEL_TOKEN env, or from `vercel login` auth file.
set -e
TEAM_ID="${TEAM_ID:-team_pPf6WSH38ILGLhFASbKqYYgL}"
TARGET_PROJECT="${VERCEL_PROJECT_NAME:-inthecircle-web}"
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

for OLD in inthecircle inthecircle-web; do
  [ "$OLD" = "$TARGET_PROJECT" ] && continue
  echo "Removing $DOMAIN from project $OLD (if it exists)..."
  RESP=$(curl -s -w "\n%{http_code}" -X DELETE "https://api.vercel.com/v9/projects/${OLD}/domains/${DOMAIN}?teamId=${TEAM_ID}" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json")
  HTTP_CODE=$(echo "$RESP" | tail -n 1)
  if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo "Auth failed (code $HTTP_CODE). Run  vercel login  again or set VERCEL_TOKEN from https://vercel.com/account/tokens"
    echo "Or fix in Dashboard: https://vercel.com → each project → Settings → Domains → remove $DOMAIN from every project except $TARGET_PROJECT."
    exit 1
  fi
  echo ""
done

echo "Adding $DOMAIN to project $TARGET_PROJECT..."
RESP2=$(curl -s -w "\n%{http_code}" -X POST "https://api.vercel.com/v10/projects/${TARGET_PROJECT}/domains?teamId=${TEAM_ID}" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"${DOMAIN}\"}")
HTTP_CODE2=$(echo "$RESP2" | tail -n 1)
if [ "$HTTP_CODE2" = "401" ] || [ "$HTTP_CODE2" = "403" ]; then
  echo "Auth failed (code $HTTP_CODE2). Run  vercel login  again or use Dashboard to add $DOMAIN to $TARGET_PROJECT."
  exit 1
fi

echo ""
echo "Done. https://$DOMAIN should now point to $TARGET_PROJECT. Run: npm run verify-domain"
