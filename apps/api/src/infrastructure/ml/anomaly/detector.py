"""Anomaly detection pipeline using Isolation Forest, LOF, and DBSCAN."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN

from src.domain.entities.analysis import AnomalyRecord

logger = logging.getLogger(__name__)


@dataclass
class AnomalyDetectionConfig:
    contamination: float = 0.05
    isolation_forest_n_estimators: int = 200
    lof_n_neighbors: int = 20
    dbscan_eps: float = 0.5
    dbscan_min_samples: int = 5
    ensemble_strategy: str = "vote"  # vote | max_score


class AnomalyDetector:
    """Ensemble anomaly detector combining multiple unsupervised algorithms."""

    def __init__(self, config: AnomalyDetectionConfig | None = None) -> None:
        self.config = config or AnomalyDetectionConfig()
        self._scaler = StandardScaler()

    def detect(
        self,
        df: pd.DataFrame,
        numeric_columns: list[str] | None = None,
    ) -> list[AnomalyRecord]:
        numeric_cols = numeric_columns or df.select_dtypes(include=np.number).columns.tolist()
        if not numeric_cols:
            logger.warning("No numeric columns available for anomaly detection")
            return []

        X = df[numeric_cols].copy()
        X = X.fillna(X.median())
        X_scaled = self._scaler.fit_transform(X)

        if_scores = self._run_isolation_forest(X_scaled)
        lof_scores = self._run_lof(X_scaled)
        dbscan_labels = self._run_dbscan(X_scaled)

        combined_scores = self._ensemble_scores(if_scores, lof_scores, dbscan_labels)

        threshold = np.percentile(combined_scores, (1 - self.config.contamination) * 100)
        anomaly_mask = combined_scores > threshold

        records: list[AnomalyRecord] = []
        for idx in np.where(anomaly_mask)[0]:
            row_data = X.iloc[idx]
            affected = self._find_affected_columns(row_data, X)
            score = float(combined_scores[idx])
            severity = self._score_to_severity(score, combined_scores)

            records.append(
                AnomalyRecord(
                    row_index=int(idx),
                    anomaly_score=round(score, 4),
                    algorithm="ensemble(IF+LOF+DBSCAN)",
                    affected_columns=affected,
                    explanation=self._explain_anomaly(row_data, X, affected),
                    severity=severity,
                )
            )

        logger.info("Detected %d anomalies out of %d rows", len(records), len(df))
        return records

    def _run_isolation_forest(self, X: np.ndarray) -> np.ndarray:
        model = IsolationForest(
            n_estimators=self.config.isolation_forest_n_estimators,
            contamination=self.config.contamination,
            random_state=42,
            n_jobs=-1,
        )
        raw_scores = model.fit_predict(X)
        decision_scores = -model.score_samples(X)
        return (decision_scores - decision_scores.min()) / (
            decision_scores.max() - decision_scores.min() + 1e-9
        )

    def _run_lof(self, X: np.ndarray) -> np.ndarray:
        n_neighbors = min(self.config.lof_n_neighbors, len(X) - 1)
        model = LocalOutlierFactor(
            n_neighbors=n_neighbors,
            contamination=self.config.contamination,
            n_jobs=-1,
        )
        model.fit_predict(X)
        lof_scores = -model.negative_outlier_factor_
        return (lof_scores - lof_scores.min()) / (lof_scores.max() - lof_scores.min() + 1e-9)

    def _run_dbscan(self, X: np.ndarray) -> np.ndarray:
        model = DBSCAN(
            eps=self.config.dbscan_eps,
            min_samples=self.config.dbscan_min_samples,
            n_jobs=-1,
        )
        labels = model.fit_predict(X)
        # DBSCAN labels noise as -1; convert to anomaly score
        return (labels == -1).astype(float)

    def _ensemble_scores(
        self,
        if_scores: np.ndarray,
        lof_scores: np.ndarray,
        dbscan_scores: np.ndarray,
    ) -> np.ndarray:
        if self.config.ensemble_strategy == "vote":
            if_anomaly = (if_scores > 0.5).astype(float)
            lof_anomaly = (lof_scores > 0.5).astype(float)
            votes = if_anomaly + lof_anomaly + dbscan_scores
            return votes / 3.0
        return (if_scores + lof_scores + dbscan_scores) / 3.0

    @staticmethod
    def _find_affected_columns(row: pd.Series, reference: pd.DataFrame) -> list[str]:
        affected = []
        for col in reference.columns:
            col_std = reference[col].std()
            col_mean = reference[col].mean()
            if col_std > 0 and abs(row[col] - col_mean) > 2 * col_std:
                affected.append(col)
        return affected or list(reference.columns[:3])

    @staticmethod
    def _explain_anomaly(row: pd.Series, reference: pd.DataFrame, affected: list[str]) -> str:
        parts = []
        for col in affected[:3]:
            col_mean = reference[col].mean()
            col_std = reference[col].std()
            z_score = (row[col] - col_mean) / (col_std + 1e-9)
            direction = "above" if row[col] > col_mean else "below"
            parts.append(f"{col} is {abs(z_score):.1f} std {direction} average ({row[col]:.2f} vs {col_mean:.2f})")
        return "; ".join(parts) if parts else "Statistical outlier across multiple dimensions"

    @staticmethod
    def _score_to_severity(score: float, all_scores: np.ndarray) -> str:
        p90 = float(np.percentile(all_scores, 90))
        p75 = float(np.percentile(all_scores, 75))
        if score >= p90:
            return "critical"
        if score >= p75:
            return "high"
        if score >= 0.5:
            return "medium"
        return "low"
