# split.py — Dataset splitting utilities for ORBIT-TRUST
# Provides temporal and object-held-out train/val/test splits.
# Author: ORBIT-TRUST Project Team

import numpy as np
import pandas as pd


def temporal_split(
    df: pd.DataFrame,
    train_cutoff: str,
    val_cutoff: str,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Split `df` into train / validation / test by the t0 timestamp.

    Parameters
    ----------
    train_cutoff : ISO date string — everything on or before this goes to train
    val_cutoff   : ISO date string — (train_cutoff, val_cutoff] goes to val;
                   everything after goes to test
    """
    data = df.copy()
    data['t0'] = pd.to_datetime(data['t0'], utc=True)
    t_train = pd.Timestamp(train_cutoff, tz='UTC')
    t_val   = pd.Timestamp(val_cutoff,   tz='UTC')

    train = data[data['t0'] <= t_train]
    val   = data[(data['t0'] > t_train) & (data['t0'] <= t_val)]
    test  = data[data['t0'] > t_val]
    return train, val, test


def object_split(
    df: pd.DataFrame,
    test_fraction: float = 0.2,
    seed: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Hold out a random fraction of unique object IDs for the test set.
    Ensures no object appears in both train and test (object-level split).
    """
    unique_ids = np.array(sorted(df['object_id'].unique()))
    rng        = np.random.default_rng(seed)
    rng.shuffle(unique_ids)
    n_test     = max(1, int(len(unique_ids) * test_fraction))
    test_ids   = set(unique_ids[:n_test])

    train_df = df[~df['object_id'].isin(test_ids)]
    test_df  = df[ df['object_id'].isin(test_ids)]
    return train_df, test_df
