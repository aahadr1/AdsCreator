#!/bin/bash
# Deploy script for VPS (Ubuntu/Debian)

set -e

echo "🚀 Starting deployment..."

# Update system
sudo apt update

# Install Node.js 22 if not installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Install PM2 for process management
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Clone or pull latest code
if [ ! -d "/var/www/adscreator" ]; then
    echo "📥 Cloning repository..."
    sudo mkdir -p /var/www
    cd /var/www
    sudo git clone https://github.com/aahadr1/AdsCreator.git adscreator
else
    echo "📥 Pulling latest changes..."
    cd /var/www/adscreator
    sudo git pull
fi

cd /var/www/adscreator

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🏗️  Building application..."
npm run build

# Set up environment variables
echo "⚙️  Setting up environment..."
if [ ! -f .env.production ]; then
    echo "⚠️  Warning: .env.production not found. Please create it with your environment variables."
    echo "Create /var/www/adscreator/.env.production with your secrets"
fi

# Stop existing process
pm2 stop adscreator || true

# Start with PM2
echo "🚀 Starting application with PM2..."
pm2 start npm --name "adscreator" -- start
pm2 save
pm2 startup

echo "✅ Deployment complete!"
echo "Your app is running on http://localhost:3000"
echo ""
echo "Next steps:"
echo "1. Set up Nginx reverse proxy (optional)"
echo "2. Configure SSL with Let's Encrypt (optional)"
echo "3. Add environment variables to .env.production"
