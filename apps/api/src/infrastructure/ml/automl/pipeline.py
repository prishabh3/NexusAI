"""AutoML pipeline — problem inference, model benchmarking, and selection."""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    roc_auc_score,
    silhouette_score,
)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from xgboost import XGBClassifier, XGBRegressor

from src.domain.entities.analysis import MLResult

logger = logging.getLogger(__name__)


@dataclass
class ModelBenchmark:
    name: str
    metrics: dict[str, float]
    fit_time_seconds: float
    predict_time_seconds: float


@dataclass
class AutoMLConfig:
    max_models: int = 5
    cv_folds: int = 3
    test_size: float = 0.2
    random_state: int = 42
    time_budget_seconds: int = 60
    include_shap: bool = True


class AutoMLPipeline:
    """Automatic ML pipeline: detects problem type, trains + ranks models."""

    CLASSIFICATION_THRESHOLD = 20  # <20 unique target values → classification

    def __init__(self, config: AutoMLConfig | None = None) -> None:
        self.config = config or AutoMLConfig()

    def infer_problem_type(self, y: pd.Series) -> str:
        n_unique = y.nunique()
        dtype = y.dtype
        if dtype == object or dtype.name == "category" or n_unique <= self.CLASSIFICATION_THRESHOLD:
            return "classification"
        return "regression"

    def run(
        self,
        df: pd.DataFrame,
        target_column: str,
        feature_columns: list[str] | None = None,
        problem_type: str | None = None,
    ) -> MLResult:
        X, y, feature_names = self._prepare_data(df, target_column, feature_columns)
        problem = problem_type or self.infer_problem_type(y)
        logger.info("AutoML running %s on %d rows, %d features", problem, len(X), len(feature_names))

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=self.config.test_size, random_state=self.config.random_state
        )

        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        candidates = self._get_candidate_models(problem)
        benchmarks: list[ModelBenchmark] = []
        best_model = None
        best_score = -np.inf

        deadline = time.time() + self.config.time_budget_seconds

        for name, model in candidates[: self.config.max_models]:
            if time.time() > deadline:
                logger.warning("AutoML time budget exceeded, stopping at %d models", len(benchmarks))
                break

            try:
                benchmark, trained = self._benchmark_model(
                    name, model, X_train_scaled, X_test_scaled, y_train, y_test, problem
                )
                benchmarks.append(benchmark)
                primary_metric = self._primary_metric(problem)
                score = benchmark.metrics.get(primary_metric, -np.inf)
                if score > best_score:
                    best_score = score
                    best_model = trained
                    best_model_name = name
            except Exception as exc:
                logger.warning("Model %s failed: %s", name, exc)

        if best_model is None:
            return MLResult(
                model_name="none",
                task_type=problem,
                metrics={},
                natural_language_summary="AutoML failed to train any models.",
            )

        feature_importance = self._compute_feature_importance(best_model, feature_names)
        shap_values: dict[str, list[float]] = {}
        if self.config.include_shap:
            shap_values = self._compute_shap(best_model, X_test_scaled, feature_names)

        best_benchmark = next(b for b in benchmarks if b.name == best_model_name)
        summary = self._generate_summary(best_model_name, problem, best_benchmark, benchmarks)

        return MLResult(
            model_name=best_model_name,
            task_type=problem,
            metrics=best_benchmark.metrics,
            feature_importance=feature_importance,
            shap_values=shap_values,
            natural_language_summary=summary,
        )

    def _prepare_data(
        self,
        df: pd.DataFrame,
        target: str,
        features: list[str] | None,
    ) -> tuple[np.ndarray, pd.Series, list[str]]:
        feature_cols = features or [c for c in df.columns if c != target]
        X_df = df[feature_cols].copy()

        for col in X_df.select_dtypes(include="object").columns:
            le = LabelEncoder()
            X_df[col] = le.fit_transform(X_df[col].astype(str))

        X_df = X_df.fillna(X_df.median(numeric_only=True))
        y = df[target].copy()
        if y.dtype == object:
            le = LabelEncoder()
            y = pd.Series(le.fit_transform(y.astype(str)), name=target)

        return X_df.values, y, feature_cols

    def _get_candidate_models(self, problem: str) -> list[tuple[str, Any]]:
        if problem == "classification":
            return [
                ("XGBClassifier", XGBClassifier(n_estimators=200, max_depth=6, random_state=42, eval_metric="logloss", verbosity=0)),
                ("RandomForest", RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)),
                ("GradientBoosting", GradientBoostingClassifier(n_estimators=100, random_state=42)),
                ("LogisticRegression", LogisticRegression(max_iter=500, random_state=42)),
            ]
        return [
            ("XGBRegressor", XGBRegressor(n_estimators=200, max_depth=6, random_state=42, verbosity=0)),
            ("RandomForest", RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)),
            ("GradientBoosting", GradientBoostingRegressor(n_estimators=100, random_state=42)),
            ("Ridge", Ridge(random_state=42)),
        ]

    def _benchmark_model(
        self,
        name: str,
        model: Any,
        X_train: np.ndarray,
        X_test: np.ndarray,
        y_train: pd.Series,
        y_test: pd.Series,
        problem: str,
    ) -> tuple[ModelBenchmark, Any]:
        t0 = time.time()
        model.fit(X_train, y_train)
        fit_time = time.time() - t0

        t1 = time.time()
        y_pred = model.predict(X_test)
        predict_time = time.time() - t1

        metrics: dict[str, float] = {}
        if problem == "classification":
            metrics["accuracy"] = round(float(accuracy_score(y_test, y_pred)), 4)
            metrics["f1_weighted"] = round(float(f1_score(y_test, y_pred, average="weighted", zero_division=0)), 4)
            try:
                y_proba = model.predict_proba(X_test)
                if y_proba.shape[1] == 2:
                    metrics["roc_auc"] = round(float(roc_auc_score(y_test, y_proba[:, 1])), 4)
            except AttributeError:
                pass
        else:
            metrics["r2"] = round(float(r2_score(y_test, y_pred)), 4)
            metrics["mae"] = round(float(mean_absolute_error(y_test, y_pred)), 4)
            metrics["rmse"] = round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4)

        return ModelBenchmark(name=name, metrics=metrics, fit_time_seconds=fit_time, predict_time_seconds=predict_time), model

    @staticmethod
    def _primary_metric(problem: str) -> str:
        return "f1_weighted" if problem == "classification" else "r2"

    @staticmethod
    def _compute_feature_importance(model: Any, feature_names: list[str]) -> dict[str, float]:
        if hasattr(model, "feature_importances_"):
            importances = model.feature_importances_
            pairs = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)
            return {name: round(float(imp), 6) for name, imp in pairs}
        if hasattr(model, "coef_"):
            coefs = np.abs(model.coef_.flatten() if model.coef_.ndim > 1 else model.coef_)
            pairs = sorted(zip(feature_names, coefs), key=lambda x: x[1], reverse=True)
            return {name: round(float(c), 6) for name, c in pairs}
        return {}

    @staticmethod
    def _compute_shap(model: Any, X: np.ndarray, feature_names: list[str]) -> dict[str, list[float]]:
        try:
            import shap
            sample = X[:min(200, len(X))]
            explainer = shap.TreeExplainer(model)
            shap_vals = explainer.shap_values(sample)
            if isinstance(shap_vals, list):
                shap_vals = shap_vals[1]
            mean_abs = np.abs(shap_vals).mean(axis=0)
            return {name: round(float(v), 6) for name, v in zip(feature_names, mean_abs)}
        except Exception as exc:
            logger.warning("SHAP computation failed: %s", exc)
            return {}

    @staticmethod
    def _generate_summary(
        model_name: str,
        problem: str,
        best: ModelBenchmark,
        all_benchmarks: list[ModelBenchmark],
    ) -> str:
        metric_str = ", ".join(f"{k}={v:.3f}" for k, v in best.metrics.items())
        other_models = [b.name for b in all_benchmarks if b.name != model_name]
        comparison = f"Outperformed: {', '.join(other_models[:3])}." if other_models else ""
        return (
            f"Best model for {problem}: **{model_name}** ({metric_str}). "
            f"Trained in {best.fit_time_seconds:.2f}s. {comparison}"
        )
