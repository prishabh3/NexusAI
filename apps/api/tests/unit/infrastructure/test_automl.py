"""Tests for AutoML pipeline — problem inference and model benchmarking."""
import numpy as np
import pandas as pd
import pytest

from src.infrastructure.ml.automl.pipeline import AutoMLConfig, AutoMLPipeline


@pytest.fixture()
def pipeline() -> AutoMLPipeline:
    return AutoMLPipeline(AutoMLConfig(max_models=2, cv_folds=2, time_budget_seconds=30, include_shap=False))


def make_classification_df(n: int = 200) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    X1 = rng.normal(0, 1, n)
    X2 = rng.normal(2, 1, n)
    y = (X1 + X2 > 2).astype(int)
    return pd.DataFrame({"feature1": X1, "feature2": X2, "target": y})


def make_regression_df(n: int = 200) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    X1 = rng.normal(0, 1, n)
    X2 = rng.normal(2, 1, n)
    y = 3 * X1 + 2 * X2 + rng.normal(0, 0.5, n)
    return pd.DataFrame({"feature1": X1, "feature2": X2, "target": y})


class TestAutoMLPipeline:
    def test_infers_classification(self, pipeline: AutoMLPipeline) -> None:
        df = make_classification_df()
        problem = pipeline.infer_problem_type(df["target"])
        assert problem == "classification"

    def test_infers_regression(self, pipeline: AutoMLPipeline) -> None:
        df = make_regression_df()
        problem = pipeline.infer_problem_type(df["target"])
        assert problem == "regression"

    def test_classification_returns_ml_result(self, pipeline: AutoMLPipeline) -> None:
        df = make_classification_df()
        result = pipeline.run(df, target_column="target")
        assert result.model_name != "none"
        assert result.task_type == "classification"
        assert "accuracy" in result.metrics or "f1_weighted" in result.metrics

    def test_regression_returns_r2(self, pipeline: AutoMLPipeline) -> None:
        df = make_regression_df()
        result = pipeline.run(df, target_column="target", problem_type="regression")
        assert result.task_type == "regression"
        assert "r2" in result.metrics

    def test_feature_importance_populated(self, pipeline: AutoMLPipeline) -> None:
        df = make_classification_df()
        result = pipeline.run(df, target_column="target")
        assert len(result.feature_importance) > 0

    def test_natural_language_summary_non_empty(self, pipeline: AutoMLPipeline) -> None:
        df = make_classification_df()
        result = pipeline.run(df, target_column="target")
        assert len(result.natural_language_summary) > 10
