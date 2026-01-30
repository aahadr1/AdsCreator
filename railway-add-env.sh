#!/bin/bash
# Add environment variables to Railway from .env.local

if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found!"
    echo "Please create .env.local with your environment variables first."
    exit 1
fi

echo "🚀 Adding environment variables to Railway..."
echo ""
echo "Make sure you're logged in and linked to your project:"
echo "  railway login"
echo "  railway link"
echo ""

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it first:"
    echo "   npm i -g @railway/cli"
    exit 1
fi

# Read .env.local and add each variable to Railway
# This is a manual guide - Railway doesn't have bulk import via CLI easily
echo "To add variables via CLI, run these commands:"
echo ""
echo "# Core Supabase (REQUIRED)"
echo 'railway variables set NEXT_PUBLIC_SUPABASE_URL="your-value-here"'
echo 'railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY="your-value-here"'
echo 'railway variables set SUPABASE_SERVICE_ROLE_KEY="your-value-here"'
echo ""
echo "# Or use the Railway dashboard for easier bulk import:"
echo "   https://railway.app/dashboard → Your Service → Variables → Raw Editor"
echo ""
echo "Your .env.local has these variables:"
grep -v '^#' .env.local | grep -v '^$' | cut -d'=' -f1 | sed 's/^/  - /'
