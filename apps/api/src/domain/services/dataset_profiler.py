"""Domain service for dataset profiling logic — pure business rules, no I/O."""

from __future__ import annotations

import math
from typing import Any

from src.domain.entities.dataset import (
    ColumnProfile,
    ColumnType,
)


def _is_null(v: Any) -> bool:
    """Return True for None and pandas/numpy NaN floats."""
    if v is None:
        return True
    if isinstance(v, float) and math.isnan(v):
        return True
    return False


class DatasetProfiler:
    """Computes statistical profiles from raw column data.

    This is a pure domain service: it operates on plain Python structures
    with no database or filesystem dependencies.
    """

    CARDINALITY_CATEGORICAL_THRESHOLD = 0.05  # <5% unique → likely categorical
    DATETIME_PATTERNS = (
        "%Y-%m-%d",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y",
        "%m/%d/%Y",
    )

    def infer_column_type(self, values: list[Any]) -> ColumnType:
        non_null = [v for v in values if not _is_null(v)]
        if not non_null:
            return ColumnType.UNKNOWN

        sample = non_null[:200]

        if all(isinstance(v, bool) for v in sample):
            return ColumnType.BOOLEAN
        if all(isinstance(v, int) for v in sample):
            return ColumnType.INTEGER
        if all(isinstance(v, float) for v in sample):
            return ColumnType.FLOAT
        if all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in sample):
            return ColumnType.FLOAT

        if all(isinstance(v, str) for v in sample):
            from datetime import datetime

            for pattern in self.DATETIME_PATTERNS:
                parsed = 0
                for v in sample[:20]:
                    try:
                        datetime.strptime(str(v), pattern)
                        parsed += 1
                    except ValueError:
                        continue
                if parsed >= min(10, len(sample[:20])):
                    return ColumnType.DATETIME
            return ColumnType.STRING

        return ColumnType.UNKNOWN

    def profile_column(
        self,
        name: str,
        values: list[Any],
        total_rows: int,
    ) -> ColumnProfile:
        dtype = self.infer_column_type(values)
        null_count = sum(1 for v in values if _is_null(v))
        non_null = [v for v in values if not _is_null(v)]
        unique_values = list(set(non_null))
        unique_count = len(unique_values)
        cardinality = unique_count / total_rows if total_rows > 0 else 0.0

        sample_values = unique_values[:10] if unique_values else []

        top_values: list[tuple[Any, int]] = []
        if dtype == ColumnType.STRING or cardinality < 0.5:
            from collections import Counter

            counter = Counter(non_null)
            top_values = counter.most_common(10)

        min_value: float | str | None = None
        max_value: float | str | None = None
        mean_value: float | None = None
        std_value: float | None = None
        skewness: float | None = None
        kurtosis: float | None = None
        quantiles: dict[str, float] = {}

        if dtype in (ColumnType.INTEGER, ColumnType.FLOAT) and non_null:
            numeric = [float(v) for v in non_null]
            min_value = min(numeric)
            max_value = max(numeric)
            n = len(numeric)
            mean_value = sum(numeric) / n
            variance = sum((x - mean_value) ** 2 for x in numeric) / n
            std_value = math.sqrt(variance) if variance > 0 else 0.0

            if std_value > 0:
                skewness = self._compute_skewness(numeric, mean_value, std_value)
                kurtosis = self._compute_kurtosis(numeric, mean_value, std_value)

            sorted_nums = sorted(numeric)
            quantiles = {
                "p25": self._percentile(sorted_nums, 25),
                "p50": self._percentile(sorted_nums, 50),
                "p75": self._percentile(sorted_nums, 75),
                "p95": self._percentile(sorted_nums, 95),
                "p99": self._percentile(sorted_nums, 99),
            }

        return ColumnProfile(
            name=name,
            dtype=dtype,
            null_count=null_count,
            null_pct=null_count / total_rows if total_rows > 0 else 0.0,
            unique_count=unique_count,
            cardinality=cardinality,
            sample_values=sample_values,
            min_value=min_value,
            max_value=max_value,
            mean_value=mean_value,
            std_value=std_value,
            skewness=skewness,
            kurtosis=kurtosis,
            quantiles=quantiles,
            top_values=top_values,
        )

    def compute_data_quality_score(self, columns: list[ColumnProfile], row_count: int) -> float:
        if not columns or row_count == 0:
            return 0.0

        completeness = 1.0 - (sum(c.null_pct for c in columns) / len(columns))
        consistency = sum(1.0 for c in columns if c.dtype != ColumnType.UNKNOWN) / len(columns)
        outlier_penalty = sum(
            min(1.0, abs(c.skewness or 0) / 5.0)
            for c in columns
            if c.dtype in (ColumnType.INTEGER, ColumnType.FLOAT)
        )
        outlier_factor = max(0.0, 1.0 - outlier_penalty / len(columns))

        return round((completeness * 0.5 + consistency * 0.3 + outlier_factor * 0.2), 4)

    def infer_primary_key(self, columns: list[ColumnProfile], row_count: int) -> str | None:
        for col in columns:
            if col.unique_count == row_count and col.null_count == 0:
                if col.name.lower() in ("id", "uuid", "key", "pk", "row_id"):
                    return col.name
        for col in columns:
            if col.unique_count == row_count and col.null_count == 0:
                return col.name
        return None

    def infer_time_column(self, columns: list[ColumnProfile]) -> str | None:
        time_hints = ("date", "time", "timestamp", "created", "updated", "at", "when")
        for col in columns:
            if col.dtype == ColumnType.DATETIME:
                return col.name
        for col in columns:
            name_lower = col.name.lower()
            if any(hint in name_lower for hint in time_hints):
                return col.name
        return None

    def infer_target_column(self, columns: list[ColumnProfile]) -> str | None:
        target_hints = ("target", "label", "y", "outcome", "result", "revenue", "sales", "churn")
        for col in columns:
            if col.name.lower() in target_hints:
                return col.name
        return None

    @staticmethod
    def _percentile(sorted_data: list[float], pct: float) -> float:
        if not sorted_data:
            return 0.0
        k = (len(sorted_data) - 1) * pct / 100
        floor_k = int(math.floor(k))
        ceil_k = int(math.ceil(k))
        if floor_k == ceil_k:
            return sorted_data[floor_k]
        return sorted_data[floor_k] + (k - floor_k) * (sorted_data[ceil_k] - sorted_data[floor_k])

    @staticmethod
    def _compute_skewness(values: list[float], mean: float, std: float) -> float:
        n = len(values)
        if n < 3 or std == 0:
            return 0.0
        return (n / ((n - 1) * (n - 2))) * sum(((x - mean) / std) ** 3 for x in values)

    @staticmethod
    def _compute_kurtosis(values: list[float], mean: float, std: float) -> float:
        n = len(values)
        if n < 4 or std == 0:
            return 0.0
        return (sum(((x - mean) / std) ** 4 for x in values) / n) - 3.0
