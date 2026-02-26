#!/bin/bash
# Run this AFTER completing gh auth login in the browser (one-time code at https://github.com/login/device)
set -e
# Go to repo root (parent of scripts/)
cd "$(dirname "$0")/.."
echo "Checking GitHub auth..."
gh auth status
echo "Creating repo inthecircle-web (public) and pushing..."
gh repo create inthecircle-web --public --source=. --remote=origin --push
echo "Done. Repo: https://github.com/Inthecircle11/inthecircle-web"
