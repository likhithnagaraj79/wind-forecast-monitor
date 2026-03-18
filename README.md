# Wind Forecast Monitor

A full-stack web application for monitoring GB national wind power generation forecasts against actuals, built using live data from the [Elexon BMRS API](https://bmrs.elexon.co.uk/api-documentation).

> **AI tools**: Claude was used to assist in building this application — for scaffolding, debugging and code review. All architectural decisions, analysis methodology, and analytical reasoning are the author's own.

---

## Live App

| | URL |
|---|---|
| **Frontend** | https://wind-forecast-monitor.vercel.app |
| **Backend API** | https://wind-forecast-monitor-backend.onrender.com/health |

---

## What it does

For a selected time window and forecast horizon, the app plots:
- **Blue line** — actual half-hourly wind generation (FUELHH dataset, `fuelType=WIND`)
- **Green dashed line** — the latest forecast published at least *N* hours before each target time (WINDFOR dataset)
- **Error metrics** — MAE, RMSE, bias, and MAPE computed live from the displayed data
- **Residual chart** — forecast error (actual − forecast) over time
- **Multi-horizon chart** — compare forecast accuracy at different lead times side by side

The forecast horizon (0–48 h) is configurable via a slider. Missing forecast data is shown as a gap — never interpolated.

---

## Project Structure

```
wind-forecast-monitor/
│
├── frontend/                            # React 18 + Vite (port 5173)
│   ├── public/
│   │   └── REint_green-1.webp           # Logo
│   ├── src/
│   │   ├── components/
│   │   │   ├── DateTimePicker.jsx       # Date range inputs + preset buttons (1d/7d/30d)
│   │   │   ├── ErrorMetrics.jsx         # MAE, RMSE, MAPE, bias summary cards
│   │   │   ├── ForecastHorizonSlider.jsx# 0–48h horizon selector
│   │   │   ├── MultiHorizonChart.jsx    # Multi-horizon overlay chart
│   │   │   ├── ResidualChart.jsx        # Forecast error bar/line chart
│   │   │   └── WindChart.jsx            # Main actual vs forecast chart (Recharts)
│   │   ├── hooks/
│   │   │   ├── useWindData.js           # Data fetching + AbortController (single horizon)
│   │   │   └── useMultiHorizonData.js   # Parallel fetches for multi-horizon view
│   │   ├── services/
│   │   │   └── api.js                   # Axios client (proxied in dev, env var in prod)
│   │   ├── utils/
│   │   │   └── dateUtils.js             # UTC datetime helpers
│   │   ├── App.jsx                      # Root component + layout
│   │   ├── App.css                      # REint AI branded styles
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js                   # Vite config + /api proxy for dev
│   ├── vercel.json                      # Vercel deploy config
│   └── package.json
│
├── backend/                             # Node.js (ESM) + Express (port 3000)
│   ├── data/
│   │   └── wind_monitor.db              # SQLite database (auto-created on first run)
│   └── src/
│       ├── models/
│       │   ├── actuals.model.js         # DB read/write for FUELHH actuals
│       │   └── forecasts.model.js       # DB read/write for WINDFOR forecasts
│       ├── routes/
│       │   └── index.js                 # /api/* route definitions
│       ├── services/
│       │   ├── bmrs.service.js          # Elexon BMRS API client (retry + backoff)
│       │   └── forecast.service.js      # Horizon matching logic
│       ├── utils/
│       │   ├── dateUtils.js             # ISO date helpers + validation
│       │   └── db.js                    # node:sqlite initialisation + schema
│       └── server.js                    # Express app, CORS, cron refresh job
│   └── package.json
│
├── analysis/                            # Offline Python analysis
│   ├── notebooks/
│   │   ├── forecast_error_analysis.ipynb    # MAE/RMSE/bias vs forecast horizon
│   │   └── wind_reliability_analysis.ipynb  # P10 firm capacity + low-wind events
│   ├── error_by_horizon.png
│   ├── error_distribution.png
│   ├── error_temporal_patterns.png
│   ├── generation_distribution.png
│   ├── low_wind_durations.png
│   ├── reliability_recommendation.png
│   ├── temporal_reliability.png
│   └── requirements.txt
│
├── render.yaml                          # Render one-click backend deploy config
├── package.json                         # Root — runs both dev servers concurrently
└── README.md
```

---

## Quick Start (local development)

### Prerequisites
- Node.js **≥ 22.5** (uses built-in `node:sqlite` — no native compilation needed)
- Python **≥ 3.11** (analysis notebooks only)

### 1. Install all dependencies

```bash
npm run install:all
```

### 2. Run frontend + backend together

```bash
npm run dev
```

This starts both servers concurrently:
- Backend → `http://localhost:3000`
- Frontend → `http://localhost:5173`

Vite proxies all `/api/*` requests to `localhost:3000` — no extra config needed.

### 3. Run separately (optional)

```bash
# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm run dev
```

### 4. Analysis notebooks

```bash
cd analysis
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
jupyter notebook
```

Make sure the backend has fetched some data first — the notebooks read directly from `backend/data/wind_monitor.db`.

---

## API Reference

All endpoints accept `start` / `end` as `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` (UTC). Data available from **2025-01-01** onwards.

| Method | Endpoint | Params | Description |
|--------|----------|--------|-------------|
| GET | `/health` | — | Health check |
| GET | `/api/combined-data` | `start`, `end`, `horizon` (0–48) | Actuals + matched forecasts |
| GET | `/api/actual-generation` | `start`, `end` | Raw actuals only |
| GET | `/api/forecast-generation` | `start`, `end`, `horizon` | Raw forecasts for range |
| GET | `/api/data-availability` | `start`, `end` | What's cached in the DB |

**Example:**
```
GET /api/combined-data?start=2025-01-15T00:00&end=2025-01-16T00:00&horizon=4
```

---

## Deployment

### Backend → Render

1. Create a new **Web Service** on [Render](https://render.com) pointing to `backend/`
2. Set environment variables in the Render dashboard:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DB_PATH` | `/opt/render/project/src/data/wind_monitor.db` |
| `FRONTEND_URL` | your Vercel frontend URL |
| `BMRS_BASE_URL` | `https://data.elexon.co.uk/bmrs/api/v1` |
| `CRON_SCHEDULE` | `0 */6 * * *` |

3. Add a **Persistent Disk** — mount path `/opt/render/project/src/data`, 1 GB
4. Build: `npm install` | Start: `npm start` | Node version: `22`

A `render.yaml` is included for one-click setup.

### Frontend → Vercel

1. Import the repo into [Vercel](https://vercel.com), set **Root Directory** to `frontend/`
2. Add environment variable:

| Variable | Value |
|----------|-------|
| `VITE_API_BASE_URL` | your Render backend URL |

3. Deploy — Vercel auto-detects Vite and builds correctly.

---

## Key Implementation Notes

- **No third-party SQLite package** — uses Node.js built-in `node:sqlite` (Node 22.5+), avoiding native compilation issues
- **WINDFOR is 1-hour resolution; FUELHH is 30-minute** — each `:30` actual maps to the `:00` WINDFOR entry (floored to the hour)
- **Horizon matching is in-memory** — one DB read per request, then O(1) Map lookup per actual, avoiding N+1 queries
- **Cron refresh** — every 6 hours the backend fetches the latest 2 days of data to keep the chart current
- **Retry with exponential backoff** — handles BMRS rate limits (HTTP 429) and transient errors
