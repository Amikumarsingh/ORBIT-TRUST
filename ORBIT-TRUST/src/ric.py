# ric.py — RIC (Radial / In-track / Cross-track) error frame for ORBIT-TRUST
# Decomposes a position error vector into the local orbital reference frame.
# Author: ORBIT-TRUST Project Team

import numpy as np


def ric_error(ref_position: np.ndarray, ref_velocity: np.ndarray, delta_r: np.ndarray) -> np.ndarray:
    """
    Project `delta_r` (km) onto the RIC frame defined by the reference state.

    RIC axes:
      R (Radial)      — unit vector along the position vector (altitude direction)
      I (In-track)    — unit vector along the velocity direction in the orbital plane
      C (Cross-track) — unit vector normal to the orbital plane (h = r × v)

    Returns a 3-element array [R, I, C] in km.
    """
    r_hat = ref_position / np.linalg.norm(ref_position)
    h_vec = np.cross(ref_position, ref_velocity)
    c_hat = h_vec / np.linalg.norm(h_vec)
    i_hat = np.cross(c_hat, r_hat)

    dr = np.asarray(delta_r, dtype=float)
    return np.array([
        np.dot(dr, r_hat),
        np.dot(dr, i_hat),
        np.dot(dr, c_hat),
    ])


def ric_components(reference_state: np.ndarray, error_state: np.ndarray) -> np.ndarray:
    """
    Convenience wrapper: accepts full 6-element state vectors [x,y,z,vx,vy,vz]
    and returns the RIC decomposition of the position error.
    """
    ref = np.asarray(reference_state, dtype=float)
    err = np.asarray(error_state, dtype=float)
    return ric_error(ref[:3], ref[3:], err[:3])
