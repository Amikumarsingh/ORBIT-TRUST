# episodes.py — Prediction episode generator for ORBIT-TRUST
# Pairs each observation with its reference state at each forecast horizon.
# Author: ORBIT-TRUST Project Team

import pandas as pd
import numpy as np

DEFAULT_HORIZONS = (1, 6, 12, 24)  # hours


def make_episodes(
    observations: pd.DataFrame,
    reference_states: pd.DataFrame,
    horizons: tuple = DEFAULT_HORIZONS,
) -> pd.DataFrame:
    """
    Build a flat episode table by matching each observation to its
    corresponding reference state at every forecast horizon.

    Parameters
    ----------
    observations     : DataFrame with columns [object_id, epoch, ...]
    reference_states : DataFrame with columns [object_id, epoch, ...]
    horizons         : forecast horizons in hours (default: 1, 6, 12, 24)

    Returns
    -------
    DataFrame with one row per (observation, horizon) pair that has a
    matching reference state.
    """
    obs = observations.copy()
    ref = reference_states.copy()

    obs['epoch'] = pd.to_datetime(obs['epoch'], utc=True)
    ref['epoch'] = pd.to_datetime(ref['epoch'], utc=True)

    obs = obs.sort_values(['object_id', 'epoch'])
    obs['tle_age_hours'] = 0.0
    obs['observation_gap_hours'] = (
        obs.groupby('object_id')['epoch']
           .diff()
           .dt.total_seconds()
           .div(3600)
           .fillna(0.0)
    )

    episode_rows = []
    for _, row in obs.iterrows():
        for h in horizons:
            target_epoch = row['epoch'] + pd.Timedelta(hours=h)
            match = ref[
                (ref['object_id'] == row['object_id']) &
                (ref['epoch'] == target_epoch)
            ]
            if match.empty:
                continue
            ref_row = match.iloc[0]
            episode_rows.append({
                'episode_id':             f'{row["object_id"]}_{row["epoch"].isoformat()}_{h}h',
                'object_id':              row['object_id'],
                't0':                     row['epoch'],
                'target_time':            target_epoch,
                'horizon_hours':          h,
                'tle_age_hours':          row.get('tle_age_hours', 0.0),
                'observation_gap_hours':  row['observation_gap_hours'],
            })

    return pd.DataFrame(episode_rows)
