#!/bin/bash
# Send test thank you email via Resend API

RESEND_API_KEY="re_2asmFnvc_3fpqh4BLgsifm5uWwcc1q4G9"
TO_EMAIL="ahmedmaidany@gmail.com"
FIRST_NAME="Ahmed"

# Read HTML template and replace placeholder
HTML_CONTENT=$(cat "$(dirname "$0")/thank-you-email.html" | sed "s/{{first_name}}/$FIRST_NAME/g")

# Send via Resend API
curl -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- << EOF
{
  "from": "Ahmed Khalifa <hello@inthecircle.co>",
  "to": ["$TO_EMAIL"],
  "subject": "thinking of you today",
  "html": $(echo "$HTML_CONTENT" | jq -Rs .)
}
EOF

echo ""
echo "✅ Test email sent to $TO_EMAIL"
