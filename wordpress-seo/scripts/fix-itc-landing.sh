#!/usr/bin/env bash
# Uploads front-page.html + fix script via FTP and runs the fix.
set -e

HOST="business63.web-hosting.com"
USER="taswfatq"
PASS='MAidany23@@'
WEB_ROOT="public_html"
THEME_TEMPLATES="${WEB_ROOT}/wp-content/themes/extendable/templates"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATES_DIR="${ROOT_DIR}/theme-extendable/templates"
FIX_PHP="${ROOT_DIR}/itc-fix-template.php"

echo "=== ITC Landing Fix ==="
echo "Host: $HOST"
echo ""

# 1. Create templates dir on server (ignore error if exists)
echo "[1/4] Ensuring remote templates dir exists..."
curl -s --ftp-create-dirs \
  --user "${USER}:${PASS}" \
  "ftp://${HOST}/${THEME_TEMPLATES}/" > /dev/null || true
echo "  OK"

# 2. Upload front-page.html
echo "[2/4] Uploading front-page.html..."
curl -s -T "${TEMPLATES_DIR}/front-page.html" \
  --user "${USER}:${PASS}" \
  "ftp://${HOST}/${THEME_TEMPLATES}/front-page.html"
echo "  OK"

# 3. Upload fix PHP script to web root
echo "[3/4] Uploading fix script to web root..."
curl -s -T "${FIX_PHP}" \
  --user "${USER}:${PASS}" \
  "ftp://${HOST}/${WEB_ROOT}/itc-fix-template.php"
echo "  OK"

echo ""
echo "=== Upload complete ==="
echo ""
echo "Now open this URL while logged into WordPress admin:"
echo "  https://inthecircle.co/itc-fix-template.php"
echo ""
echo "It will show what's in the DB."
echo "Then open this URL to apply the fix (updates the DB template with front-page.html content):"
echo "  https://inthecircle.co/itc-fix-template.php?update=1"
echo ""
echo "After it says 'Done', delete the file:"
echo "  https://inthecircle.co/itc-fix-template.php?delete_self=1"
echo "  (or delete it manually from File Manager at public_html/itc-fix-template.php)"
