from dataclasses import dataclass
from typing import Optional

ORBITAL_COLUMNS = [
    "object_id","epoch","object_name","object_type",
    "inclination_deg","raan_deg","eccentricity",
    "arg_perigee_deg","mean_anomaly_deg","mean_motion_rev_day",
    "bstar","tle_age_hours","observation_gap_hours"
]

STATE_COLUMNS = ["x","y","z","vx","vy","vz"]

ENV_COLUMNS = ["f107","f107a","kp","ap","dst"]

TARGET_COLUMNS = [
    "error_x","error_y","error_z",
    "error_vx","error_vy","error_vz",
    "error_r","error_i","error_c"
]

EPISODE_COLUMNS = [
    "episode_id","object_id","t0","target_time","horizon_hours"
] + ORBITAL_COLUMNS[2:] + ENV_COLUMNS + [
    f"sgp4_{c}" for c in STATE_COLUMNS
] + [
    f"truth_{c}" for c in STATE_COLUMNS
] + TARGET_COLUMNS
