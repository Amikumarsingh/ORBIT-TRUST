"""
ORBIT-TRUST — Unit tests for the ML backend.

Run from the Spacemain/backend directory:
    pytest ../tests/test_ml.py -v

The tests cover:
  - extract_features: verifies that a known-good TLE produces a complete
    feature dict with physically plausible values.
  - predict_single: verifies that the classifier returns a well-formed
    prediction dict with probabilities that sum to 100 %.
"""

import sys
import os

# Make sure the backend package is importable when running from the repo root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from app.ml import extract_features, predict_single


# ---------------------------------------------------------------------------
# A real ISS TLE (epoch 2024-11-17) — always classifies as active satellite
# ---------------------------------------------------------------------------
ISS_LINE1 = '1 25544U 98067A   24321.65912821  .00009845  00000+0  42102-3 0  9997'
ISS_LINE2 = '2 25544  28.4697  41.2857 0001752 252.6034 107.4367 15.21129706700501'


class TestExtractFeatures:
    """Tests for the SGP4-based feature extraction helper."""

    def test_returns_dict_for_valid_tle(self):
        """extract_features should return a non-None dict for a valid TLE."""
        result = extract_features(ISS_LINE1, ISS_LINE2)
        assert result is not None, 'Expected a feature dict, got None'
        assert isinstance(result, dict)

    def test_all_expected_keys_present(self):
        """The feature dict must contain every key the model was trained on."""
        expected_keys = {
            'eccentricity', 'inclination', 'raan', 'arg_perigee',
            'mean_anomaly', 'mean_motion', 'semi_major_axis',
            'x', 'y', 'z', 'vx', 'vy', 'vz',
            'altitude', 'perigee', 'apogee', 'orbital_period',
            'distance_from_center', 'specific_orbital_energy', 'velocity_magnitude',
        }
        result = extract_features(ISS_LINE1, ISS_LINE2)
        missing = expected_keys - result.keys()
        assert not missing, f'Missing feature keys: {missing}'

    def test_iss_altitude_is_plausible(self):
        """ISS orbits between ~400 km and ~430 km altitude."""
        result = extract_features(ISS_LINE1, ISS_LINE2)
        assert 350 < result['altitude'] < 500, (
            f"ISS altitude {result['altitude']:.1f} km is outside the expected range"
        )

    def test_iss_velocity_is_plausible(self):
        """ISS orbital speed is roughly 7.66 km/s."""
        result = extract_features(ISS_LINE1, ISS_LINE2)
        assert 7.0 < result['velocity_magnitude'] < 8.5, (
            f"ISS velocity {result['velocity_magnitude']:.3f} km/s is outside the expected range"
        )

    def test_returns_none_for_garbage_input(self):
        """Completely invalid TLE strings should return None, not raise."""
        result = extract_features('not a tle line', 'also not a tle line')
        assert result is None


class TestPredictSingle:
    """Tests for the classifier wrapper."""

    def test_returns_well_formed_dict(self):
        """predict_single should return a dict with the required keys."""
        features = extract_features(ISS_LINE1, ISS_LINE2)
        assert features is not None
        pred = predict_single(features)
        for key in ('label', 'type', 'confidence', 'debris_prob', 'sat_prob'):
            assert key in pred, f"Missing key '{key}' in prediction dict"

    def test_probabilities_sum_to_100(self):
        """debris_prob + sat_prob must equal 100 % (within floating-point tolerance)."""
        features = extract_features(ISS_LINE1, ISS_LINE2)
        pred = predict_single(features)
        total = pred['debris_prob'] + pred['sat_prob']
        assert abs(total - 100.0) < 0.1, f'Probabilities sum to {total}, expected 100'

    def test_label_matches_type_string(self):
        """The numeric label and the human-readable type string must be consistent."""
        features = extract_features(ISS_LINE1, ISS_LINE2)
        pred = predict_single(features)
        if pred['label'] == 1:
            assert pred['type'] == 'DEBRIS'
        else:
            assert pred['type'] == 'ACTIVE SATELLITE'

    def test_confidence_in_valid_range(self):
        """Confidence must be between 0 and 100 inclusive."""
        features = extract_features(ISS_LINE1, ISS_LINE2)
        pred = predict_single(features)
        assert 0.0 <= pred['confidence'] <= 100.0
