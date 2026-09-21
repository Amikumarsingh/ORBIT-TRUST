# main.py — FastAPI application entry point for ORBIT-TRUST
# Registers all routers and configures CORS for the React frontend.
# Author: ORBIT-TRUST Project Team

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import predict, live, upload, risk, stats, trajectory

app = FastAPI(
    title='ORBIT-TRUST API',
    description=(
        'ORBIT-TRUST — AI-powered REST API for real-time space debris classification, '
        'collision risk scoring, SGP4 trajectory prediction, and live NASA/NORAD TLE ingestion. '
        'Built on physics-guided feature engineering and a Random Forest trained on 13,172 real orbital objects.'
    ),
    version='1.0.0',
    contact={'name': 'ORBIT-TRUST Project Team'},
    license_info={'name': 'MIT'},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

for router in [predict.router, live.router, upload.router,
               risk.router, stats.router, trajectory.router]:
    app.include_router(router)


@app.get('/', tags=['Root'])
def root():
    """Health-check and endpoint directory for the ORBIT-TRUST API."""
    return {
        'project': 'ORBIT-TRUST',
        'version': '1.0.0',
        'docs':    '/docs',
        'redoc':   '/redoc',
        'endpoints': {
            'POST /predict/single':     'Classify a single TLE object',
            'POST /predict/bulk':       'Classify multiple TLE objects at once',
            'GET  /live/fetch':         'Fetch & classify live NASA/NORAD data',
            'GET  /live/stats':         'Object count per live source',
            'POST /upload/tle':         'Upload a .txt TLE file for classification',
            'GET  /risk/score':         'Collision risk score for a satellite',
            'GET  /stats/model':        'Model info, accuracy, feature importances',
            'GET  /stats/health':       'API health check',
            'GET  /trajectory/predict': 'SGP4 trajectory at 1h/6h/12h/24h horizons',
        },
    }
