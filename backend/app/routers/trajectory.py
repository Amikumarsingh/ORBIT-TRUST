# trajectory.py — SGP4 trajectory prediction router for ORBIT-TRUST
# Propagates a satellite forward at 1h/6h/12h/24h and decomposes
# the displacement into the RIC (Radial/In-track/Cross-track) frame.
# Author: ORBIT-TRUST Project Team

import sys
import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Query
import numpy as np

# Make the ORBIT-TRUST research package importable from the backend tree
_ORBIT_TRUST_SRC = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', 'ORBIT-TRUST', 'src')
)
if _ORBIT_TRUST_SRC not in sys.path:
    sys.path.insert(0, _ORBIT_TRUST_SRC)

from sgp4_pipeline import parse_tle, propagate   # noqa: E402
from ric import ric_error                         # noqa: E402
from app.ml import extract_features, classify_object  # noqa: E402

router = APIRouter(prefix='/trajectory', tags=['Trajectory'])

PREDICTION_HORIZONS_H = [1, 6, 12, 24]


def _build_horizon_predictions(tle_line1: str, tle_line2: str) -> list[dict]:
    """
    Propagate the satellite at each horizon and return a list of dicts —
    one per horizon — containing predicted ECI state and RIC-frame displacement
    relative to the current (t=0) position.
    """
    sat     = parse_tle(tle_line1, tle_line2)
    t_now   = datetime.now(timezone.utc)
    r0, v0  = propagate(sat, t_now)

    horizon_results = []
    for hours in PREDICTION_HORIZONS_H:
        t_target = t_now + timedelta(hours=hours)
        try:
            r_pred, v_pred = propagate(sat, t_target)
        except RuntimeError:
            continue

        delta_pos = r_pred - r0
        ric        = ric_error(r0, v0, delta_pos)
        drift_km   = float(np.linalg.norm(delta_pos))

        horizon_results.append({
            'horizon_hours':        hours,
            'target_time_utc':      t_target.isoformat(),
            'x_km':                 round(float(r_pred[0]), 3),
            'y_km':                 round(float(r_pred[1]), 3),
            'z_km':                 round(float(r_pred[2]), 3),
            'vx_km_s':              round(float(v_pred[0]), 6),
            'vy_km_s':              round(float(v_pred[1]), 6),
            'vz_km_s':              round(float(v_pred[2]), 6),
            'altitude_km':          round(float(np.linalg.norm(r_pred)) - 6371.0, 2),
            'distance_from_now_km': round(drift_km, 3),
            'ric': {
                'radial_km':      round(float(ric[0]), 3),
                'intrack_km':     round(float(ric[1]), 3),
                'crosstrack_km':  round(float(ric[2]), 3),
                'total_km':       round(float(np.linalg.norm(ric)), 3),
            },
        })

    return horizon_results


@router.get('/predict')
def predict_trajectory(
    line1: str = Query(..., description='TLE Line 1'),
    line2: str = Query(..., description='TLE Line 2'),
    name:  str = Query('UNKNOWN', description='Object name'),
):
    """
    Predict the trajectory of a satellite at +1h, +6h, +12h, and +24h using
    the ORBIT-TRUST SGP4 pipeline. Returns ECI positions, velocities, altitudes,
    and RIC-frame displacement components at each horizon.
    """
    feats = extract_features(line1, line2)
    if feats is None:
        raise HTTPException(status_code=422, detail='SGP4 propagation failed for this TLE.')

    pred = classify_object(feats)

    try:
        horizons = _build_horizon_predictions(line1, line2)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Trajectory propagation error: {exc}')

    if not horizons:
        raise HTTPException(status_code=500, detail='No valid horizon predictions produced.')

    return {
        'name':           name,
        'norad_id':       line1[2:7].strip(),
        'classification': pred['type'],
        'debris_prob':    pred['debris_prob'],
        'current': {
            'x_km':          round(feats['x'], 3),
            'y_km':          round(feats['y'], 3),
            'z_km':          round(feats['z'], 3),
            'altitude_km':   round(feats['altitude'], 2),
            'velocity_km_s': round(feats['velocity_magnitude'], 4),
        },
        'horizons':       horizons,
        'pipeline':       'ORBIT-TRUST SGP4 + RIC',
        'horizons_hours': PREDICTION_HORIZONS_H,
    }
