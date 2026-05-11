# Patrimony v2

Personal wealth ledger. Runs on any device, installs on iPhone.

## What's in this build
- **IndexedDB storage** — data persists reliably, never rate-limits
- **Server-side price proxy** — Yahoo Finance + CoinGecko, works on all devices  
- **Live FX rates** — auto-fetches USD/PHP on load
- **PWA** — installs on iPhone home screen as native app
- **Error boundaries** — crashes are contained, app recovers cleanly

## Deploy

### 1. Create GitHub repo
Go to github.com/new → name it `patrimony` → Private → Create

### 2. Push code
```bash
cd ~/Downloads/patrimony-nextjs
npm install
git init
git add .
git commit -m "Patrimony v2"
git branch -M main
git remote add origin https://github.com/arevname/patrimony.git
git push -u origin main
```
When asked for password, use your GitHub Personal Access Token.

### 3. Deploy on Vercel
vercel.com/new → Continue with GitHub → select `patrimony` → Deploy

### 4. Install on iPhone
Safari → your Vercel URL → Share → Add to Home Screen

## Update the app
When I give you new code, replace the file in `components/Patrimony.jsx`, then:
```bash
cd ~/Downloads/patrimony-nextjs
git add .
git commit -m "update"
git push
```
Vercel auto-deploys in ~30 seconds.

## Local dev
```bash
npm run dev
# Open http://localhost:3000
```
