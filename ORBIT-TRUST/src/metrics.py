# metrics.py — Evaluation metrics for ORBIT-TRUST trajectory predictions
# Author: ORBIT-TRUST Project Team

import numpy as np


def rmse(y_true, y_pred) -> float:
    """Root Mean Squared Error between truth and prediction arrays."""
    t = np.asarray(y_true, dtype=float)
    p = np.asarray(y_pred, dtype=float)
    return float(np.sqrt(np.mean((t - p) ** 2)))


def mae(y_true, y_pred) -> float:
    """Mean Absolute Error between truth and prediction arrays."""
    t = np.asarray(y_true, dtype=float)
    p = np.asarray(y_pred, dtype=float)
    return float(np.mean(np.abs(t - p)))


def coverage(y_true, lower_bound, upper_bound) -> float:
    """
    Empirical coverage: fraction of truth values that fall within
    [lower_bound, upper_bound] — used for uncertainty interval evaluation.
    """
    t = np.asarray(y_true, dtype=float)
    return float(np.mean((t >= lower_bound) & (t <= upper_bound)))
