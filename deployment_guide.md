# Deployment Guide

This app has two independently deployed pieces:

| Part | Platform | Why |
|------|----------|-----|
| Backend (Node.js + SQLite) | [Render](https://render.com) | Supports persistent disk for SQLite, free tier, Node 22 |
| Frontend (React + Vite) | [Vercel](https://vercel.com) | Zero-config Vite deployment, free tier, global CDN |

---

## Step 1 — Deploy the Backend on Render

### 1.1 Push the repo to GitHub

```bash
cd "/Users/likhith_n/Desktop/REint AI/wind-forecast-monitor"
git init          # if not already a repo
git add .
git commit -m "initial commit"
```

Create a new repo on GitHub (e.g. `wind-forecast-monitor`) and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/wind-forecast-monitor.git
git push -u origin main
```

### 1.2 Create a new Web Service on Render

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New → Web Service**
2. Connect your GitHub account and select the `wind-forecast-monitor` repo
3. Fill in the service settings:

| Field | Value |
|-------|-------|
| **Name** | `wind-forecast-monitor-backend` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or Starter for no cold starts) |

4. Under **Environment** → **Environment Variables**, add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `BMRS_BASE_URL` | `https://data.elexon.co.uk/bmrs/api/v1` |
| `DB_PATH` | `/opt/render/project/src/data/wind_monitor.db` |
| `CRON_SCHEDULE` | `0 */6 * * *` |
| `FRONTEND_URL` | *(leave blank for now — fill in after Step 2)* |

5. Under **Advanced** → **Add Disk**:

| Field | Value |
|-------|-------|
| **Name** | `wind-data` |
| **Mount Path** | `/opt/render/project/src/data` |
| **Size** | `1 GB` |

> The persistent disk is critical — without it, the SQLite database is wiped on every redeploy.

6. Click **Create Web Service** and wait for the build to finish (~2 minutes).

7. Test the backend is live:
```bash
curl https://YOUR-SERVICE.onrender.com/health
# Expected: {"status":"ok","timestamp":"..."}
```

> **Note on cold starts**: Render's free tier spins down after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. Upgrade to the $7/month Starter plan to avoid this.

---

## Step 2 — Deploy the Frontend on Vercel

### 2.1 Import the repo into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo (`wind-forecast-monitor`)
3. Configure the project:

| Field | Value |
|-------|-------|
| **Framework Preset** | Vite *(auto-detected)* |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` *(auto-detected)* |
| **Output Directory** | `dist` *(auto-detected)* |

4. Under **Environment Variables**, add:

| Key | Value |
|-----|-------|
| `VITE_API_BASE_URL` | `https://YOUR-SERVICE.onrender.com` *(from Step 1)* |

5. Click **Deploy** and wait ~1 minute.

6. Vercel will give you a URL like `https://wind-forecast-monitor.vercel.app`

---

## Step 3 — Wire the two services together

### 3.1 Update CORS on the backend

Go back to the Render dashboard → your web service → **Environment** → edit `FRONTEND_URL`:

```
FRONTEND_URL=https://wind-forecast-monitor.vercel.app
```

Render will automatically redeploy with the new value.

### 3.2 Smoke test end-to-end

```bash
# 1. Health check
curl https://YOUR-SERVICE.onrender.com/health

# 2. Fetch one day of data (triggers first BMRS fetch — takes ~10 seconds)
curl "https://YOUR-SERVICE.onrender.com/api/combined-data?start=2025-01-15&end=2025-01-15&horizon=4"

# 3. Open the frontend
open https://wind-forecast-monitor.vercel.app
```

---

## Environment Variable Reference

### Backend (`backend/.env` for local / Render dashboard for production)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the Express server listens on |
| `NODE_ENV` | `development` | Set to `production` on Render |
| `DB_PATH` | `./data/wind_monitor.db` | SQLite file path |
| `BMRS_BASE_URL` | `https://data.elexon.co.uk/bmrs/api/v1` | Elexon API base URL |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin(s), comma-separated |
| `CRON_SCHEDULE` | `0 */6 * * *` | How often to auto-refresh recent data |

### Frontend (`frontend/.env` for local / Vercel dashboard for production)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | *(empty)* | Backend URL. Empty = Vite proxies to localhost in dev |

---

## Updating the deployment

Any `git push` to the `main` branch will automatically trigger a redeploy on both Render and Vercel (if you enabled auto-deploy during setup).

```bash
git add .
git commit -m "your change"
git push origin main
# Render and Vercel both redeploy automatically
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Frontend shows "Failed to load data" | `VITE_API_BASE_URL` not set in Vercel | Add env var and redeploy |
| Backend returns CORS error | `FRONTEND_URL` not updated after Vercel deploy | Update env var on Render |
| Database empty after Render redeploy | No persistent disk attached | Add disk in Render → Advanced |
| First request takes 30+ seconds | Render free tier cold start | Upgrade to Starter or use an uptime monitor to ping `/health` every 10 min |
| `node:sqlite` not available | Node version < 22.5 on Render | Set Node version to `22` in Render settings |

---

## Setting Node 22 on Render

Render uses the `engines` field in `package.json` to pick the Node version. The backend already has:

```json
"engines": { "node": ">=22.5.0" }
```

You can also pin it explicitly in the Render dashboard under **Settings → Build & Deploy → Node Version → 22**.
