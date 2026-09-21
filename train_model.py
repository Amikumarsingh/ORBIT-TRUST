# train_model.py — Standalone model training script for ORBIT-TRUST
# Reads TLE files, extracts SGP4 features, balances with SMOTE,
# trains a Random Forest, and saves the model artefacts.
# Author: ORBIT-TRUST Project Team

import os
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from sgp4.api import Satrec, jday
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from imblearn.over_sampling import SMOTE

EARTH_RADIUS_KM = 6371.0
GRAVITATIONAL_PARAM = 398600.4418


def load_tle_features(filepath: str, class_label: int) -> list[dict]:
    """
    Parse a TLE file, propagate each object to the current UTC epoch via SGP4,
    and return a list of feature dicts with the given class label.
    Silently skips entries that fail propagation or produce NaN state vectors.
    """
    records = []
    with open(filepath, 'r') as fh:
        raw_lines = fh.readlines()

    for i in range(0, len(raw_lines), 3):
        if i + 2 >= len(raw_lines):
            break
        try:
            l1  = raw_lines[i + 1].strip()
            l2  = raw_lines[i + 2].strip()
            sat = Satrec.twoline2rv(l1, l2)
            now = datetime.utcnow()
            jd, frac = jday(now.year, now.month, now.day, now.hour, now.minute, now.second)
            err, r, v = sat.sgp4(jd, frac)
            if err != 0 or any(x != x for x in list(r) + list(v)):
                continue
            geocentric_dist = np.sqrt(r[0]**2 + r[1]**2 + r[2]**2)
            speed_km_s      = np.sqrt(v[0]**2 + v[1]**2 + v[2]**2)
            sma             = 6378.1 / (1.0 - sat.ecco)
            records.append({
                'eccentricity':            sat.ecco,
                'inclination':             sat.inclo,
                'raan':                    sat.nodeo,
                'arg_perigee':             sat.argpo,
                'mean_anomaly':            sat.mo,
                'mean_motion':             sat.no_kozai,
                'semi_major_axis':         sma,
                'x': r[0], 'y': r[1], 'z': r[2],
                'vx': v[0], 'vy': v[1], 'vz': v[2],
                'altitude':                sma - EARTH_RADIUS_KM,
                'perigee':                 sma * (1.0 - sat.ecco),
                'apogee':                  sma * (1.0 + sat.ecco),
                'orbital_period':          86400.0 / sat.no_kozai,
                'distance_from_center':    geocentric_dist,
                'specific_orbital_energy': (speed_km_s**2) / 2.0 - (GRAVITATIONAL_PARAM / geocentric_dist),
                'velocity_magnitude':      speed_km_s,
                'label':                   class_label,
            })
        except Exception:
            continue
    return records


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')

DEBRIS_FILES   = ['cosmos-1408-debris.txt', 'cosmos-2251-debris.txt',
                  'fengyun-1c-debris.txt',  'iridium-33-debris.txt']
SATELLITE_FILE = ['active-sate.txt']

all_records = []
for fname in DEBRIS_FILES:
    all_records += load_tle_features(os.path.join(DATA_DIR, fname), class_label=1)
for fname in SATELLITE_FILE:
    all_records += load_tle_features(os.path.join(DATA_DIR, fname), class_label=0)

df = pd.DataFrame(all_records).dropna()
X  = df.drop(columns=['label'])
y  = df['label']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
X_balanced, y_balanced = SMOTE(random_state=42).fit_resample(X_train, y_train)

clf = RandomForestClassifier(
    n_estimators=100,
    random_state=42,
    oob_score=True,
    n_jobs=-1,
)
clf.fit(X_balanced, y_balanced)

y_pred = clf.predict(X_test)
print('Accuracy :', accuracy_score(y_test, y_pred))
print(classification_report(y_test, y_pred))
print('OOB Score:', clf.oob_score_)

feature_names = list(X.columns)
output_dir    = os.path.join(BASE_DIR, 'backend', 'models')
joblib.dump(clf,           os.path.join(output_dir, 'rf_model.joblib'))
joblib.dump(feature_names, os.path.join(output_dir, 'features.joblib'))
print('Model artefacts saved to backend/models/')
