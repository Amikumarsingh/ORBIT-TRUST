# sgp4_pipeline.py — SGP4 propagation utilities for ORBIT-TRUST
# Wraps the sgp4 library to provide clean parse/propagate/residual helpers.
# Author: ORBIT-TRUST Project Team

import numpy as np
from datetime import datetime, timezone
from sgp4.api import Satrec
from sgp4.conveniences import jday_datetime


def parse_tle(tle_line1: str, tle_line2: str) -> Satrec:
    """Parse a TLE pair and return an initialised Satrec propagator object."""
    return Satrec.twoline2rv(tle_line1.strip(), tle_line2.strip())


def propagate(satellite: Satrec, epoch: datetime):
    """
    Propagate `satellite` to `epoch` (UTC) using SGP4.
    Returns (position_km, velocity_km_s) as numpy arrays.
    Raises RuntimeError if the SGP4 error code is non-zero.
    """
    if epoch.tzinfo is None:
        epoch = epoch.replace(tzinfo=timezone.utc)
    jd, frac = jday_datetime(epoch)
    err_code, r_vec, v_vec = satellite.sgp4(jd, frac)
    if err_code != 0:
        raise RuntimeError(f'SGP4 error code {err_code} at epoch {epoch.isoformat()}')
    return np.asarray(r_vec, dtype=float), np.asarray(v_vec, dtype=float)


def state_vector(satellite: Satrec, epoch: datetime) -> np.ndarray:
    """Return the 6-element [x, y, z, vx, vy, vz] state vector at `epoch`."""
    r, v = propagate(satellite, epoch)
    return np.concatenate([r, v])


def residual(truth: np.ndarray, prediction: np.ndarray) -> np.ndarray:
    """Compute the element-wise residual (truth − prediction)."""
    return np.asarray(truth, dtype=float) - np.asarray(prediction, dtype=float)
