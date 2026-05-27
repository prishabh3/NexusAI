"""Tests for AnomalyDetector — validates detection quality, not exact results."""

import numpy as np
import pandas as pd
import pytest

from src.infrastructure.ml.anomaly.detector import AnomalyDetectionConfig, AnomalyDetector


@pytest.fixture()
def detector() -> AnomalyDetector:
    return AnomalyDetector(AnomalyDetectionConfig(contamination=0.1))


def make_normal_df(n: int = 200) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    return pd.DataFrame(
        {
            "x": rng.normal(0, 1, n),
            "y": rng.normal(5, 2, n),
            "z": rng.normal(-3, 0.5, n),
        }
    )


class TestAnomalyDetector:
    def test_returns_list_of_anomaly_records(self, detector: AnomalyDetector) -> None:
        df = make_normal_df()
        # Inject obvious outliers
        df.loc[0, "x"] = 100.0
        df.loc[1, "y"] = 500.0

        records = detector.detect(df)
        assert isinstance(records, list)
        assert len(records) > 0

    def test_detects_injected_outlier(self, detector: AnomalyDetector) -> None:
        df = make_normal_df(n=300)
        df.loc[0, "x"] = 200.0  # extreme outlier

        records = detector.detect(df)
        flagged_indices = {r.row_index for r in records}
        assert 0 in flagged_indices, "Extreme outlier at row 0 was not detected"

    def test_anomaly_scores_are_normalized(self, detector: AnomalyDetector) -> None:
        df = make_normal_df()
        df.loc[0, "x"] = 100.0

        records = detector.detect(df)
        for r in records:
            assert 0.0 <= r.anomaly_score <= 1.0

    def test_anomaly_has_affected_columns(self, detector: AnomalyDetector) -> None:
        df = make_normal_df()
        df.loc[0, "x"] = 100.0

        records = detector.detect(df)
        assert any(len(r.affected_columns) > 0 for r in records)

    def test_severity_assigned(self, detector: AnomalyDetector) -> None:
        df = make_normal_df()
        df.loc[0, "x"] = 100.0

        records = detector.detect(df)
        valid_severities = {"low", "medium", "high", "critical"}
        assert all(r.severity in valid_severities for r in records)

    def test_no_numeric_columns_returns_empty(self, detector: AnomalyDetector) -> None:
        df = pd.DataFrame({"name": ["alice", "bob", "charlie"]})
        records = detector.detect(df)
        assert records == []

    def test_respects_column_subset(self, detector: AnomalyDetector) -> None:
        df = make_normal_df()
        df.loc[0, "x"] = 100.0

        records = detector.detect(df, numeric_columns=["x"])
        assert len(records) > 0
