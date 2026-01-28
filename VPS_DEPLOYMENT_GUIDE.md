# VPS Deployment Guide for AdsCreator

## Prerequisites
- A VPS running Ubuntu 22.04 (recommended providers: Hetzner, Linode, DigitalOcean)
- SSH access to your VPS
- Your domain name (optional but recommended)

## Step 1: Get a VPS

### Option A: Hetzner (Cheapest - €4/month)
1. Go to https://www.hetzner.com/cloud
2. Create account
3. Create a new server:
   - Location: Choose closest to your users
   - Image: Ubuntu 22.04
   - Type: CX22 (€4.51/month) - 2 vCPU, 4GB RAM
   - Add SSH key or use password
4. Note your server's IP address

### Option B: DigitalOcean ($6/month)
1. Go to https://www.digitalocean.com
2. Create Droplet
3. Choose:
   - Ubuntu 22.04
   - Basic plan: $6/month (1 vCPU, 1GB RAM)
4. Add SSH key
5. Note your droplet's IP address

## Step 2: Connect to Your VPS

```bash
# Replace YOUR_IP with your VPS IP address
ssh root@YOUR_IP

# If using SSH key:
ssh -i ~/.ssh/your_key root@YOUR_IP
```

## Step 3: Run the Deployment Script

Once connected to your VPS:

```bash
# Download and run the deployment script
curl -fsSL https://raw.githubusercontent.com/aahadr1/AdsCreator/main/deploy-vps.sh | bash
```

**What this script does:**
- Installs Node.js 22
- Installs PM2 (process manager)
- Clones your repository
- Installs dependencies
- Builds your Next.js app
- Starts it with PM2

## Step 4: Add Environment Variables

Create a file with your secrets:

```bash
cd /var/www/adscreator
nano .env.production
```

Add all your environment variables:

```bash
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# Replicate
REPLICATE_API_TOKEN=your_replicate_token

# FAL
FAL_KEY=your_fal_key

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_key

# Stripe (if using billing)
STRIPE_SECRET_KEY=your_stripe_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_public

# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET_NAME=your_bucket_name

# Add any other secrets your app needs
```

Save and exit (Ctrl+X, then Y, then Enter)

## Step 5: Restart Your App

```bash
pm2 restart adscreator
```

## Step 6: Set Up Nginx (Reverse Proxy)

This lets people access your app via your domain instead of `yourip:3000`

```bash
# Install Nginx
sudo apt install nginx -y

# Create Nginx config
sudo nano /etc/nginx/sites-available/adscreator
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;  # Replace with your domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/adscreator /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

## Step 7: Point Your Domain

In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):

1. Add an A record:
   - Name: `@`
   - Type: `A`
   - Value: `YOUR_VPS_IP`
   - TTL: `3600`

2. Add a CNAME for www (optional):
   - Name: `www`
   - Type: `CNAME`
   - Value: `yourdomain.com`

Wait 5-60 minutes for DNS to propagate.

## Step 8: Add SSL Certificate (Free with Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts
# Certbot will automatically configure Nginx for HTTPS
```

Your site will now be available at `https://yourdomain.com`!

## Managing Your App

### View app logs:
```bash
pm2 logs adscreator
```

### Restart app:
```bash
pm2 restart adscreator
```

### Stop app:
```bash
pm2 stop adscreator
```

### Update app (deploy new changes):
```bash
cd /var/www/adscreator
git pull
npm install
npm run build
pm2 restart adscreator
```

### Check app status:
```bash
pm2 status
```

### Monitor resources:
```bash
htop  # Install with: sudo apt install htop
```

## Troubleshooting

### App won't start?
```bash
# Check logs
pm2 logs adscreator --lines 100

# Check if port 3000 is in use
sudo lsof -i :3000

# Restart everything
pm2 delete adscreator
cd /var/www/adscreator
pm2 start npm --name "adscreator" -- start
```

### Can't access from browser?
```bash
# Check if Nginx is running
sudo systemctl status nginx

# Check if firewall is blocking
sudo ufw status
sudo ufw allow 80
sudo ufw allow 443
```

### Out of memory?
```bash
# Add swap space (extra memory from disk)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Cost Breakdown

### Monthly costs:
- **VPS**: €4-6/month (Hetzner cheapest)
- **Domain**: ~$12/year (~$1/month)
- **SSL**: Free (Let's Encrypt)
- **Total**: ~$5-7/month

### One-time costs:
- Domain registration: ~$12/year

## Pros of VPS Hosting

✅ **Cheapest option** - $5-6/month all-in
✅ **Full control** - Install anything, no restrictions
✅ **No build time limits** - Unlike Vercel/Netlify
✅ **Run Playwright, FFmpeg** - Full Node.js support
✅ **Predictable pricing** - No surprise bills
✅ **Learn valuable skills** - Server management

## Cons of VPS Hosting

❌ **More work** - You manage everything
❌ **Security updates** - You're responsible
❌ **No auto-scaling** - Fixed resources
❌ **Requires SSH knowledge** - Command line skills needed
❌ **Manual deployments** - No Git push to deploy (can be automated)

## Making Deployments Easier

### Option A: Create a deployment script locally

Create `deploy.sh` on your computer:

```bash
#!/bin/bash
ssh root@YOUR_VPS_IP << 'EOF'
cd /var/www/adscreator
git pull
npm install
npm run build
pm2 restart adscreator
EOF
```

Then just run `./deploy.sh` to deploy!

### Option B: Set up GitHub Actions (Advanced)

This auto-deploys when you push to GitHub. I can help you set this up if interested.

## Need Help?

Common issues and solutions:
- **Port already in use**: `pm2 delete all && pm2 start npm --name adscreator -- start`
- **Permission denied**: Run with `sudo`
- **Git pull fails**: `cd /var/www/adscreator && git reset --hard && git pull`
- **App crashes**: Check logs with `pm2 logs adscreator`

---

**Questions?** Let me know which step you're stuck on!
