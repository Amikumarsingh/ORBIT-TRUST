# ml.py — Core ML inference module for ORBIT-TRUST
# SGP4-based feature extraction and Random Forest classification.
# Author: ORBIT-TRUST Project Team

import os
import warnings
import numpy as np
import pandas as pd
import joblib
from datetime import datetime, timezone
from sgp4.api import Satrec, jday

EARTH_RADIUS_KM = 6371.0
GRAVITATIONAL_PARAM = 398600.4418  # km^3/s^2 — standard gravitational parameter for Earth

_BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_RF_MODEL  = joblib.load(os.path.join(_BASE_DIR, 'models', 'rf_model.joblib'))
_FEAT_COLS = joblib.load(os.path.join(_BASE_DIR, 'models', 'features.joblib'))


def extract_features(tle_line1: str, tle_line2: str) -> dict | None:
    """
    Parse a TLE pair, propagate to the current UTC epoch via SGP4,
    and return a flat dict of 20 orbital + physical features.
    Returns None if propagation fails or produces invalid state vectors.
    """
    try:
        satellite = Satrec.twoline2rv(tle_line1.strip(), tle_line2.strip())
        utc_now   = datetime.now(timezone.utc)
        jd, frac  = jday(utc_now.year, utc_now.month, utc_now.day,
                         utc_now.hour, utc_now.minute, utc_now.second)
        err_code, pos_vec, vel_vec = satellite.sgp4(jd, frac)

        if err_code != 0:
            return None
        if any(c != c for c in list(pos_vec) + list(vel_vec)):   # IEEE NaN check
            return None

        geocentric_dist = float(np.linalg.norm(pos_vec))
        speed_km_s      = float(np.linalg.norm(vel_vec))
        semi_major_axis = 6378.1 / (1.0 - satellite.ecco)

        return {
            'eccentricity':            satellite.ecco,
            'inclination':             satellite.inclo,
            'raan':                    satellite.nodeo,
            'arg_perigee':             satellite.argpo,
            'mean_anomaly':            satellite.mo,
            'mean_motion':             satellite.no_kozai,
            'semi_major_axis':         semi_major_axis,
            'x': pos_vec[0], 'y': pos_vec[1], 'z': pos_vec[2],
            'vx': vel_vec[0], 'vy': vel_vec[1], 'vz': vel_vec[2],
            'altitude':                semi_major_axis - EARTH_RADIUS_KM,
            'perigee':                 semi_major_axis * (1.0 - satellite.ecco),
            'apogee':                  semi_major_axis * (1.0 + satellite.ecco),
            'orbital_period':          86400.0 / satellite.no_kozai,
            'distance_from_center':    geocentric_dist,
            'specific_orbital_energy': (speed_km_s ** 2) / 2.0 - (GRAVITATIONAL_PARAM / geocentric_dist),
            'velocity_magnitude':      speed_km_s,
        }
    except Exception:
        return None


def classify_object(feature_dict: dict) -> dict:
    """
    Run the trained Random Forest on a single feature dict.
    Returns label (0=satellite, 1=debris), type string, and probability scores.
    """
    input_row   = pd.DataFrame([{col: feature_dict[col] for col in _FEAT_COLS}])
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        class_probs = _RF_MODEL.predict_proba(input_row)[0]
        predicted   = int(_RF_MODEL.predict(input_row)[0])
    return {
        'label':       predicted,
        'type':        'DEBRIS' if predicted == 1 else 'ACTIVE SATELLITE',
        'confidence':  round(float(max(class_probs)) * 100, 2),
        'debris_prob': round(float(class_probs[1]) * 100, 2),
        'sat_prob':    round(float(class_probs[0]) * 100, 2),
    }


# Backward-compatible alias used by routers
predict_single = classify_object


def parse_tle_text(raw_tle: str) -> list[dict]:
    """
    Parse a multi-object TLE block (3-line format) and classify every entry.
    Silently skips malformed lines or objects that fail SGP4 propagation.
    """
    non_empty  = [ln for ln in raw_tle.strip().splitlines() if ln.strip()]
    classified = []
    for idx in range(0, len(non_empty), 3):
        if idx + 2 >= len(non_empty):
            break
        obj_name = non_empty[idx].strip()
        l1       = non_empty[idx + 1].strip()
        l2       = non_empty[idx + 2].strip()
        if not (l1.startswith('1 ') and l2.startswith('2 ')):
            continue
        feats = extract_features(l1, l2)
        if feats is None:
            continue
        classified.append({
            'name':     obj_name,
            'norad_id': l1[2:7].strip(),
            **classify_object(feats),
            **feats,
        })
    return classified
