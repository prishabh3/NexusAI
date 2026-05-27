"""Unit tests for DatasetProfiler domain service."""
import math
import pytest

from src.domain.entities.dataset import ColumnType
from src.domain.services.dataset_profiler import DatasetProfiler


@pytest.fixture()
def profiler() -> DatasetProfiler:
    return DatasetProfiler()


class TestInferColumnType:
    def test_integer_list(self, profiler: DatasetProfiler) -> None:
        assert profiler.infer_column_type([1, 2, 3, 4, 5]) == ColumnType.INTEGER

    def test_float_list(self, profiler: DatasetProfiler) -> None:
        assert profiler.infer_column_type([1.1, 2.2, 3.3]) == ColumnType.FLOAT

    def test_string_list(self, profiler: DatasetProfiler) -> None:
        assert profiler.infer_column_type(["a", "b", "c"]) == ColumnType.STRING

    def test_boolean_list(self, profiler: DatasetProfiler) -> None:
        assert profiler.infer_column_type([True, False, True]) == ColumnType.BOOLEAN

    def test_datetime_iso_string(self, profiler: DatasetProfiler) -> None:
        values = ["2024-01-01", "2024-02-01", "2024-03-01"] * 7
        result = profiler.infer_column_type(values)
        assert result == ColumnType.DATETIME

    def test_empty_list_returns_unknown(self, profiler: DatasetProfiler) -> None:
        assert profiler.infer_column_type([]) == ColumnType.UNKNOWN

    def test_all_none_returns_unknown(self, profiler: DatasetProfiler) -> None:
        assert profiler.infer_column_type([None, None, None]) == ColumnType.UNKNOWN


class TestProfileColumn:
    def test_numeric_column_computes_stats(self, profiler: DatasetProfiler) -> None:
        values = [1.0, 2.0, 3.0, 4.0, 5.0, None]
        profile = profiler.profile_column("price", values, 6)

        assert profile.name == "price"
        assert profile.dtype == ColumnType.FLOAT
        assert profile.null_count == 1
        assert abs(profile.null_pct - 1 / 6) < 0.001
        assert profile.mean_value is not None
        assert abs(profile.mean_value - 3.0) < 0.01
        assert profile.min_value == 1.0
        assert profile.max_value == 5.0
        assert profile.std_value is not None
        assert profile.std_value > 0

    def test_string_column_has_top_values(self, profiler: DatasetProfiler) -> None:
        values = ["A", "B", "A", "A", "C", "B"]
        profile = profiler.profile_column("category", values, 6)

        assert profile.dtype == ColumnType.STRING
        assert len(profile.top_values) > 0
        top_name, top_count = profile.top_values[0]
        assert top_name == "A"
        assert top_count == 3

    def test_cardinality_computed_correctly(self, profiler: DatasetProfiler) -> None:
        values = list(range(100))
        profile = profiler.profile_column("id", values, 100)
        assert profile.cardinality == 1.0

    def test_quantiles_present_for_numeric(self, profiler: DatasetProfiler) -> None:
        values = list(range(1, 101))
        profile = profiler.profile_column("value", values, 100)
        assert "p50" in profile.quantiles
        assert abs(profile.quantiles["p50"] - 50.5) < 1.0


class TestComputeDataQualityScore:
    def test_complete_numeric_dataset_high_score(self, profiler: DatasetProfiler) -> None:
        from src.domain.entities.dataset import ColumnProfile

        cols = [
            profiler.profile_column("a", list(range(100)), 100),
            profiler.profile_column("b", list(range(100)), 100),
        ]
        score = profiler.compute_data_quality_score(cols, 100)
        assert score > 0.7

    def test_empty_columns_returns_zero(self, profiler: DatasetProfiler) -> None:
        score = profiler.compute_data_quality_score([], 0)
        assert score == 0.0


class TestInferPrimaryKey:
    def test_identifies_unique_id_column(self, profiler: DatasetProfiler) -> None:
        values = list(range(50))
        profile = profiler.profile_column("id", values, 50)
        result = profiler.infer_primary_key([profile], 50)
        assert result == "id"

    def test_returns_none_for_non_unique_column(self, profiler: DatasetProfiler) -> None:
        values = ["A", "B", "A", "B"]
        profile = profiler.profile_column("category", values, 4)
        result = profiler.infer_primary_key([profile], 4)
        assert result is None


class TestInferTimeColumn:
    def test_detects_datetime_column(self, profiler: DatasetProfiler) -> None:
        dates = ["2024-01-01"] * 10
        date_profile = profiler.profile_column("created_at", dates, 10)
        result = profiler.infer_time_column([date_profile])
        assert result == "created_at"
