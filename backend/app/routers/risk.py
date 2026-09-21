# risk.py — Collision risk scoring router for ORBIT-TRUST
# Computes conjunction distances against all known debris catalogues.
# Author: ORBIT-TRUST Project Team

import math
from fastapi import APIRouter, HTTPException, Query
from app.ml import extract_features, classify_object, parse_tle_text
from app.routers.live import fetch_tle

router = APIRouter(prefix='/risk', tags=['Risk'])

CONJUNCTION_THRESHOLD_KM = 50.0
DEBRIS_CATALOGUES = ['cosmos_1408', 'cosmos_2251', 'fengyun_1c', 'iridium_33']


def _euclidean_distance_km(obj_a: dict, obj_b: dict) -> float:
    """3-D Euclidean distance between two ECI position vectors (km)."""
    return math.sqrt(
        (obj_a['x'] - obj_b['x']) ** 2 +
        (obj_a['y'] - obj_b['y']) ** 2 +
        (obj_a['z'] - obj_b['z']) ** 2
    )


def _compute_risk_level(closest_km: float, debris_probability: float) -> str:
    """
    Map minimum conjunction distance and debris probability to a risk tier.
    Thresholds are based on standard conjunction screening practice.
    """
    if closest_km < 10 or debris_probability > 90:
        return 'CRITICAL'
    if closest_km < 25 or debris_probability > 70:
        return 'HIGH'
    if closest_km < 50 or debris_probability > 50:
        return 'MEDIUM'
    return 'LOW'


@router.get('/score')
def risk_score(
    line1: str = Query(...),
    line2: str = Query(...),
    name:  str = Query('TARGET SAT'),
):
    """
    Compute a collision risk score for the given TLE by screening it against
    all four major debris catalogues (Cosmos-1408, Cosmos-2251, Fengyun-1C, Iridium-33).
    """
    target_feats = extract_features(line1, line2)
    if target_feats is None:
        raise HTTPException(status_code=422, detail='SGP4 propagation failed.')

    target_pred = classify_object(target_feats)

    all_debris_objects = []
    for catalogue in DEBRIS_CATALOGUES:
        try:
            all_debris_objects += parse_tle_text(fetch_tle(catalogue))
        except Exception:
            continue

    conjunctions = []
    for debris_obj in all_debris_objects:
        dist = _euclidean_distance_km(target_feats, debris_obj)
        if dist < CONJUNCTION_THRESHOLD_KM:
            conjunctions.append({
                'name':        debris_obj['name'],
                'norad_id':    debris_obj['norad_id'],
                'distance_km': round(dist, 3),
            })

    conjunctions.sort(key=lambda c: c['distance_km'])
    closest_km = conjunctions[0]['distance_km'] if conjunctions else 9999.0
    risk_tier  = _compute_risk_level(closest_km, target_pred['debris_prob'])

    return {
        'satellite':          name,
        'norad_id':           line1[2:7].strip(),
        'classification':     target_pred['type'],
        'debris_probability': target_pred['debris_prob'],
        'risk_level':         risk_tier,
        'closest_debris_km':  closest_km,
        'conjunctions_found': len(conjunctions),
        'close_objects':      conjunctions[:10],
        'altitude_km':        round(target_feats['altitude'], 2),
        'velocity_km_s':      round(target_feats['velocity_magnitude'], 4),
    }
