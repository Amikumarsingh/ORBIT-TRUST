# predict.py — Classification router for ORBIT-TRUST
# Handles single-object and bulk TLE classification via the RF model.
# Author: ORBIT-TRUST Project Team

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.ml import extract_features, classify_object, parse_tle_text

router = APIRouter(prefix='/predict', tags=['Predict'])


class SingleTLERequest(BaseModel):
    name:  str = 'UNKNOWN'
    line1: str
    line2: str


class BulkTLERequest(BaseModel):
    tle_text: str   # raw multi-object TLE block (3-line format)


@router.post('/single')
def predict_single_tle(body: SingleTLERequest):
    """Classify one TLE object and return orbital parameters alongside the prediction."""
    feats = extract_features(body.line1, body.line2)
    if feats is None:
        raise HTTPException(status_code=422, detail='SGP4 propagation failed for this TLE.')
    pred = classify_object(feats)
    return {
        'name':     body.name,
        'norad_id': body.line1[2:7].strip(),
        **pred,
        'position_km':   {'x': feats['x'],  'y': feats['y'],  'z': feats['z']},
        'velocity_km_s': {'vx': feats['vx'], 'vy': feats['vy'], 'vz': feats['vz']},
        'orbital': {
            'altitude_km':      round(feats['altitude'], 2),
            'eccentricity':     feats['eccentricity'],
            'inclination_rad':  feats['inclination'],
            'semi_major_axis':  round(feats['semi_major_axis'], 2),
            'orbital_period_s': round(feats['orbital_period'], 2),
            'velocity_km_s':    round(feats['velocity_magnitude'], 4),
        },
    }


@router.post('/bulk')
def predict_bulk_tle(body: BulkTLERequest):
    """Classify all objects in a pasted multi-object TLE block."""
    results = parse_tle_text(body.tle_text)
    if not results:
        raise HTTPException(status_code=422, detail='No valid TLE entries found in input.')
    debris_list = [r for r in results if r['label'] == 1]
    sat_list    = [r for r in results if r['label'] == 0]
    return {
        'total':           len(results),
        'debris_count':    len(debris_list),
        'satellite_count': len(sat_list),
        'objects':         results,
    }
