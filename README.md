# Wind Forecast Monitor

A full-stack web application for monitoring GB national wind power generation forecasts against actuals, built using live data from the [Elexon BMRS API](https://bmrs.elexon.co.uk/api-documentation).

> **AI tools**: Claude Code (Anthropic) was used to assist in building this application — for scaffolding, debugging, and code review. All architectural decisions, analysis methodology, and analytical reasoning are the author's own.

---

## Live Demo

- **Frontend**: https://wind-forecast-monitor.vercel.app *(update after deployment)*
- **Backend API**: https://wind-forecast-monitor.onrender.com/health *(update after deployment)*

---

## What it does

For a selected time window and forecast horizon, the app plots:
- **Blue line** — actual half-hourly wind generation (FUELHH dataset, `fuelType=WIND`)
- **Green dashed line** — the latest forecast that was published at least *N* hours before each target time (WINDFOR dataset)

The forecast horizon (0–48 h) is configurable via a slider. Missing forecast data is shown as a gap — never interpolated.

---

## Project Structure

```
wind-forecast-monitor/
├── frontend/                   # React 18 + Vite app (port 5173)
│   ├── public/
│   │   └── REint_green-1.webp  # Logo
│   └── src/
│       ├── components/
│       │   ├── DateTimePicker.jsx       # Start/End datetime inputs + presets
│       │   ├── ForecastHorizonSlider.jsx
│       │   └── WindChart.jsx            # Recharts ComposedChart
│       ├── hooks/
│       │   └── useWindData.js           # Data fetching + AbortController
│       ├── services/
│       │   └── api.js                   # Axios client
│       ├── utils/
│       │   └── dateUtils.js             # UTC datetime helpers
│       ├── App.jsx
│       ├── App.css                      # REint AI branded styles
│       ├── index.css
│       └── main.jsx
│
├── backend/                    # Node.js (ESM) + Express API (port 3000)
│   ├── data/                   # SQLite database (auto-created on first run)
│   └── src/
│       ├── models/
│       │   ├── actuals.model.js    # DB queries for FUELHH actuals
│       │   └── forecasts.model.js  # DB queries for WINDFOR forecasts
│       ├── routes/
│       │   └── index.js            # /api/* route handlers
│       ├── services/
│       │   ├── bmrs.service.js     # Elexon BMRS API client (retry + backoff)
│       │   └── forecast.service.js # Horizon matching logic
│       ├── utils/
│       │   ├── dateUtils.js        # ISO date/datetime helpers + validation
│       │   └── db.js               # node:sqlite initialisation
│       └── server.js               # Express app + cron refresh
│
├── analysis/
│   ├── notebooks/
│   │   ├── forecast_error_analysis.ipynb   # MAE/RMSE/bias vs horizon
│   │   └── wind_reliability_analysis.ipynb # Reliability & capacity recommendation
│   └── requirements.txt
│
└── README.md
```

---

## Quick Start (local development)

### Prerequisites
- Node.js **≥ 22.5** (uses built-in `node:sqlite` — no native compilation needed)
- Python **≥ 3.11** (for the analysis notebooks only)

### 1. Backend

```bash
cd backend
cp .env.example .env   # defaults work out-of-the-box for local dev
npm install
npm run dev            # starts on http://localhost:3000
```

The SQLite database is created automatically at `backend/data/wind_monitor.db` on first request.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev            # starts on http://localhost:5173
```

Vite proxies all `/api/*` requests to `localhost:3000` — no extra config needed in development.

### 3. Analysis notebooks

```bash
cd analysis
pip install -r requirements.txt
jupyter notebook
```

Open `notebooks/forecast_error_analysis.ipynb` or `notebooks/wind_reliability_analysis.ipynb`. Make sure the backend has fetched some data first (the notebooks read directly from the SQLite DB).

---

## API Reference

All endpoints accept `start` / `end` as `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` (treated as UTC). Data is available from **2025-01-01** onwards.

| Method | Endpoint | Query params | Description |
|--------|----------|--------------|-------------|
| GET | `/health` | — | Health check |
| GET | `/api/combined-data` | `start`, `end`, `horizon` (0–48) | Actuals + matched forecasts — **main endpoint** |
| GET | `/api/actual-generation` | `start`, `end` | Raw actuals only |
| GET | `/api/forecast-generation` | `start`, `end`, `horizon` | Raw forecasts for range |
| GET | `/api/data-availability` | `start`, `end` | What's cached in the DB |

Example:
```
GET /api/combined-data?start=2025-01-15T00:00&end=2025-01-16T00:00&horizon=4
```

---

## Deployment

### Backend → Render

1. Create a new **Web Service** on [Render](https://render.com) pointing to the `backend/` directory.
2. Set the following environment variables in the Render dashboard:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DB_PATH` | `/opt/render/project/src/data/wind_monitor.db` |
| `FRONTEND_URL` | your Vercel URL (e.g. `https://wind-forecast-monitor.vercel.app`) |
| `BMRS_BASE_URL` | `https://data.elexon.co.uk/bmrs/api/v1` |

3. Add a **Persistent Disk** (mount path `/opt/render/project/src/data`, 1 GB) so the SQLite database survives redeploys.
4. Build command: `npm install` | Start command: `npm start` | Node version: `22`

A `render.yaml` is included for one-click setup.

### Frontend → Vercel

1. Import the repo into [Vercel](https://vercel.com), set **Root Directory** to `frontend/`.
2. Add environment variable:

| Variable | Value |
|----------|-------|
| `VITE_API_BASE_URL` | your Render backend URL (e.g. `https://wind-forecast-monitor.onrender.com`) |

3. Deploy — Vercel auto-detects Vite and builds correctly.

---

## Key implementation notes

- **No third-party SQLite package** — uses Node.js built-in `node:sqlite` (available since Node 22.5), avoiding native compilation issues.
- **WINDFOR is 1-hour resolution; FUELHH is 30-minute** — each `:30` actual maps to the `:00` WINDFOR entry (floored to the hour) so forecast coverage is ~100% at short horizons.
- **Horizon matching is in-memory** — one DB read per request, then O(1) Map lookup per actual, avoiding N+1 query problems for large ranges.
- **Cron refresh** — every 6 hours the backend fetches the latest 2 days of data so the chart is always current.
- **Retry with exponential backoff** — handles BMRS rate limits (HTTP 429) and transient server errors.
