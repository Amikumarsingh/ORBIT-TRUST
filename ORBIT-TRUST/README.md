# ORBIT-TRUST Dataset & Baseline Pipeline

This repository is the implementation scaffold for the proposed
physics-guided, observation-adaptive space-debris trajectory prediction study.

## Scientific sequence

1. Ingest historical GP/TLE observations.
2. Parse and propagate with SGP4.
3. Synchronize reference states.
4. Generate independent prediction episodes.
5. Calculate Cartesian and RIC errors.
6. Create temporal and object-held-out splits.
7. Benchmark SGP4, classical ML, LSTM/Transformer, and residual hybrids.
8. Add observation-age/gap and environmental features.
9. Add uncertainty calibration.
10. Extend to conjunction screening.

## Important methodological rule

Never report experimental performance numbers until the pipeline has actually
generated them. Dataset size, RMSE, coverage, p-values, and effect sizes must
come from executed experiments.

## Expected core tables

- prediction_episodes.parquet
- train.parquet
- validation.parquet
- test.parquet
- baseline_metrics.csv

## Reference state requirement

A supervised residual-learning experiment requires a defensible reference
trajectory. TLE-to-TLE self-comparison is not equivalent to ground truth.
