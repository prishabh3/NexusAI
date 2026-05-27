"""Unit tests for domain entity behavior."""
import uuid
import pytest

from src.domain.entities.analysis import Analysis, AnalysisResult, AnalysisStatus, AnalysisType
from src.domain.entities.dataset import Dataset, DatasetSchema, DatasetStatus
from src.domain.entities.insight import Insight, InsightCategory, InsightSeverity


class TestDatasetEntity:
    def test_mark_ready_updates_status_and_schema(self) -> None:
        dataset = Dataset(
            name="test",
            original_filename="test.csv",
            file_path="/tmp/test.csv",
            file_format="csv",
        )
        schema = DatasetSchema(
            columns=[],
            row_count=100,
            column_count=5,
            size_bytes=1024,
        )
        dataset.mark_ready(schema)
        assert dataset.status == DatasetStatus.READY
        assert dataset.schema is not None
        assert dataset.schema.row_count == 100

    def test_mark_failed_sets_failed_status(self) -> None:
        dataset = Dataset(
            name="test",
            original_filename="test.csv",
            file_path="/tmp/test.csv",
            file_format="csv",
        )
        dataset.mark_failed()
        assert dataset.status == DatasetStatus.FAILED

    def test_increment_analysis_count(self) -> None:
        dataset = Dataset(
            name="test",
            original_filename="test.csv",
            file_path="/tmp/test.csv",
            file_format="csv",
        )
        assert dataset.analysis_count == 0
        dataset.increment_analysis_count()
        assert dataset.analysis_count == 1

    def test_invalid_format_raises(self) -> None:
        with pytest.raises(ValueError):
            Dataset(
                name="test",
                original_filename="test.xlsx",
                file_path="/tmp/test.xlsx",
                file_format="xlsx",
            )


class TestAnalysisEntity:
    def _make_analysis(self) -> Analysis:
        return Analysis(
            dataset_id=uuid.uuid4(),
            analysis_type=AnalysisType.EDA,
        )

    def test_start_transitions_to_running(self) -> None:
        analysis = self._make_analysis()
        analysis.start()
        assert analysis.status == AnalysisStatus.RUNNING
        assert analysis.started_at is not None

    def test_complete_sets_result_and_duration(self) -> None:
        analysis = self._make_analysis()
        analysis.start()
        result = AnalysisResult(
            summary="Done",
            key_findings=["Finding 1"],
            confidence_score=0.85,
        )
        analysis.complete(result)
        assert analysis.status == AnalysisStatus.COMPLETED
        assert analysis.result is not None
        assert analysis.duration_seconds is not None
        assert analysis.duration_seconds >= 0

    def test_fail_sets_error_message(self) -> None:
        analysis = self._make_analysis()
        analysis.fail("Something went wrong")
        assert analysis.status == AnalysisStatus.FAILED
        assert analysis.error_message == "Something went wrong"


class TestInsightEntity:
    def test_verify_sets_flag_and_notes(self) -> None:
        insight = Insight(
            dataset_id=uuid.uuid4(),
            title="Revenue dropped",
            body="Revenue dropped by 15% in Q3",
            category=InsightCategory.TREND,
            severity=InsightSeverity.WARNING,
            confidence_score=0.82,
        )
        insight.verify(notes="Confirmed by finance team")
        assert insight.is_verified is True
        assert insight.verification_notes == "Confirmed by finance team"
