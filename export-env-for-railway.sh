#!/bin/bash
# Export environment variables for Railway
# This script helps you bulk-import env vars to Railway

echo "🔐 Environment Variables Export for Railway"
echo "============================================="
echo ""
echo "INSTRUCTIONS:"
echo "1. Copy your .env.local file values"
echo "2. Go to Railway Dashboard → Your Service → Variables"
echo "3. Click 'Raw Editor' or 'Bulk Import'"
echo "4. Paste the variables"
echo ""
echo "REQUIRED VARIABLES (from .env.example):"
echo "----------------------------------------"
cat << 'EOF'

# CRITICAL - Your app won't work without these:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_URL=
SUPABASE_BUCKET_PUBLIC=
SUPABASE_ASSETS_BUCKET=

# AI Services (Required for core features)
REPLICATE_API_TOKEN=
OPENAI_API_KEY=

# Storage (Required)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=
R2_S3_ENDPOINT=

# App Configuration
NEXT_PUBLIC_BASE_URL=https://your-app.railway.app
NEXT_PUBLIC_APP_URL=https://your-app.railway.app
NEXT_PUBLIC_API_BASE_URL=https://your-app.railway.app
NODE_ENV=production

# Optional but recommended
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_PRICE_BASIC=
NEXT_PUBLIC_PRICE_PRO=

# Optional - Add if you use these features
ELEVENLABS_API_KEY=
SYNC_API_KEY=
TAVILY_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_KV_NAMESPACE_ID_TASKS=
BROWSER_WORKER_URL=
BROWSER_WORKER_SECRET=

EOF

echo ""
echo "----------------------------------------"
echo ""
echo "TO ADD THESE TO RAILWAY:"
echo "1. Fill in the values from your .env.local file"
echo "2. Railway Dashboard → Service → Variables tab"
echo "3. Use 'Raw Editor' to paste all at once"
echo "4. Or add them one by one"
echo ""
echo "After adding variables, Railway will auto-redeploy!"
