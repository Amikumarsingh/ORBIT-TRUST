# stats.py — Model metadata and health-check router for ORBIT-TRUST
# Author: ORBIT-TRUST Project Team

import os
import joblib
from fastapi import APIRouter

router = APIRouter(prefix='/stats', tags=['Stats'])

# Resolve model directory: routers/ -> app/ -> backend/
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_RF_MODEL    = joblib.load(os.path.join(_BACKEND_DIR, 'models', 'rf_model.joblib'))
_FEAT_COLS   = joblib.load(os.path.join(_BACKEND_DIR, 'models', 'features.joblib'))


@router.get('/model')
def model_info():
    """Return model metadata, OOB accuracy, and top-8 feature importances."""
    importance_map = dict(zip(
        _FEAT_COLS,
        [round(float(v), 6) for v in _RF_MODEL.feature_importances_],
    ))
    top_features = dict(
        sorted(importance_map.items(), key=lambda kv: kv[1], reverse=True)[:8]
    )
    return {
        'model_type':        'RandomForestClassifier',
        'n_estimators':      _RF_MODEL.n_estimators,
        'oob_score':         round(_RF_MODEL.oob_score_, 6),
        'n_features':        len(_FEAT_COLS),
        'features':          _FEAT_COLS,
        'top_8_features':    top_features,
        'classes':           ['ACTIVE SATELLITE (0)', 'DEBRIS (1)'],
        'data_source':       'NASA/NORAD via CelesTrak',
        'training_objects':  13172,
        'debris_objects':    2773,
        'satellite_objects': 10399,
        'accuracy':          0.9886,
    }


@router.get('/health')
def health_check():
    """Lightweight liveness probe — confirms the API and model are loaded."""
    return {
        'status':       'ok',
        'model_loaded': True,
        'project':      'ORBIT-TRUST',
        'api_version':  '1.0.0',
    }
