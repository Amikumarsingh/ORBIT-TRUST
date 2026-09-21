# ORBIT-TRUST

**Physics-guided, observation-adaptive space-debris detection and trajectory prediction.**

ORBIT-TRUST is a full-stack AI platform that ingests live NASA/NORAD orbital data,
classifies every tracked object as active satellite or debris using machine learning,
predicts future trajectories, and presents everything on an interactive real-time
3-D dashboard.

---

## Project structure

```
Spacemain/
├── backend/              FastAPI REST API (Python)
│   ├── app/
│   │   ├── main.py       App entry-point, CORS, router registration
│   │   ├── ml.py         SGP4 feature extraction + RF inference
│   │   └── routers/
│   │       ├── predict.py   POST /predict/single  POST /predict/bulk
│   │       ├── live.py      GET  /live/fetch       GET  /live/sources
│   │       ├── upload.py    POST /upload/tle
│   │       ├── risk.py      GET  /risk/score
│   │       └── stats.py     GET  /stats/model      GET  /stats/health
│   ├── models/           Saved RF model + feature list (joblib)
│   └── requirements.txt
│
├── frontend/             React + Vite dashboard
│   └── src/
│       ├── App.jsx       Nav + page routing
│       ├── pages/
│       │   ├── GlobeView.jsx   Three.js live 3-D Earth globe
│       │   ├── Dashboard.jsx   Plotly 3-D orbital map + model stats
│       │   ├── LiveFeed.jsx    Fetch & classify live TLE sources
│       │   ├── UploadTLE.jsx   Upload .txt file or paste TLE text
│       │   └── RiskScore.jsx   Collision risk assessment per satellite
│       └── api.js        Axios wrappers for all backend endpoints
│
├── ORBIT-TRUST/          Research pipeline scaffold
│   ├── src/
│   │   ├── sgp4_pipeline.py   SGP4 propagation + residual computation
│   │   ├── episodes.py        Prediction episode generation
│   │   ├── ric.py             Radial/In-track/Cross-track error frame
│   │   ├── metrics.py         RMSE, MAE, coverage
│   │   ├── split.py           Temporal + object-held-out splits
│   │   ├── schema.py          Parquet column schema
│   │   └── validate_project.py  Directory structure check
│   ├── configs/default.yaml   Horizons, frames, split dates, paths
│   └── README.md
│
├── data/                 TLE files (CelesTrak snapshots)
├── tle_data/             Hourly downloaded TLE snapshots
├── tests/test_ml.py      Unit tests for ML backend
├── detection_output.ipynb  Training notebook (clean, runnable)
├── train_model.py        Standalone training script
├── hourly_download.py    Automated TLE downloader
├── check_live_data.py    Quick live-feed sanity check
└── requirements.txt      Notebook + training dependencies
```

---

## Quick start

### 1 — Install dependencies

```bash
cd Spacemain
pip install -r requirements.txt          # notebook + training
pip install -r backend/requirements.txt  # API server
cd frontend && npm install               # dashboard
```

### 2 — Train the model

```bash
cd Spacemain
python train_model.py
# → saves backend/models/rf_model.joblib
# → saves backend/models/features.joblib
```

Or run `detection_output.ipynb` cell-by-cell in Jupyter.

### 3 — Start the API

```bash
cd Spacemain/backend
uvicorn app.main:app --reload --port 8000
# Swagger UI → http://localhost:8000/docs
```

### 4 — Start the dashboard

```bash
cd Spacemain/frontend
npm run dev
# → http://localhost:5173
```

### 5 — Run tests

```bash
cd Spacemain/backend
pytest ../tests/test_ml.py -v
```

---

## Data sources

All data is fetched live from [CelesTrak](https://celestrak.org) — the public
distributor of official NASA/NORAD TLE sets.

| Source | Objects | Label |
|---|---|---|
| Active satellites | ~10,000 | 0 (active) |
| Cosmos-1408 debris | ~1,500 | 1 (debris) |
| Cosmos-2251 debris | ~1,000 | 1 (debris) |
| Fengyun-1C debris | ~3,000 | 1 (debris) |
| Iridium-33 debris | ~500 | 1 (debris) |

Training set: **13,172 real orbital objects** — 2,773 debris, 10,399 active satellites.

---

## Model performance

| Metric | Score |
|---|---|
| Test accuracy | 98.86 % |
| OOB score | 99.44 % |
| Precision (debris) | 97 % |
| Recall (debris) | 98 % |
| F1-score (debris) | 97 % |
| Held-out file accuracy (Iridium-33) | 98.48 % |

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/predict/single` | Classify one TLE object |
| POST | `/predict/bulk` | Classify a multi-object TLE block |
| GET | `/live/fetch` | Fetch + classify a live CelesTrak source |
| GET | `/live/sources` | List available live sources |
| POST | `/upload/tle` | Upload a `.txt` TLE file |
| GET | `/risk/score` | Collision risk score for a satellite |
| GET | `/stats/model` | Model metadata + feature importances |
| GET | `/stats/health` | API health check |

---

## Research pipeline (ORBIT-TRUST/)

The `ORBIT-TRUST/` sub-package implements the full scientific sequence for the
trajectory-prediction paper:

1. Ingest historical GP/TLE observations
2. Parse and propagate with SGP4
3. Synchronise reference states
4. Generate independent prediction episodes
5. Calculate Cartesian and RIC errors
6. Create temporal and object-held-out splits
7. Benchmark SGP4, classical ML, LSTM/Transformer, and residual hybrids
8. Add observation-age/gap and environmental features
9. Add uncertainty calibration
10. Extend to conjunction screening

Prediction horizons: **1 h, 6 h, 12 h, 24 h**
Error frame: **RIC (Radial / In-track / Cross-track)**

---

## License

MIT
