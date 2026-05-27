"""Time-series forecasting with Prophet and XGBoost fallback."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd

from src.domain.entities.analysis import ForecastPoint

logger = logging.getLogger(__name__)


@dataclass
class ForecastConfig:
    periods: int = 30
    frequency: str = "D"  # D=daily, W=weekly, M=monthly, H=hourly
    confidence_interval: float = 0.95
    seasonality_mode: str = "multiplicative"
    include_history: bool = True
    changepoint_prior_scale: float = 0.05
    custom_seasonalities: list[dict[str, Any]] = field(default_factory=list)


class ProphetForecaster:
    """Wraps Prophet with automatic frequency detection and trend decomposition."""

    def __init__(self, config: ForecastConfig | None = None) -> None:
        self.config = config or ForecastConfig()
        self._model: Any = None

    def fit_predict(
        self,
        df: pd.DataFrame,
        date_column: str,
        value_column: str,
    ) -> list[ForecastPoint]:
        try:
            from prophet import Prophet  # type: ignore[import]
        except ImportError:
            logger.warning("Prophet not available, falling back to XGBoost forecaster")
            return self._xgboost_forecast(df, date_column, value_column)

        prophet_df = df[[date_column, value_column]].copy()
        prophet_df.columns = ["ds", "y"]
        prophet_df["ds"] = pd.to_datetime(prophet_df["ds"])
        prophet_df = prophet_df.dropna().sort_values("ds")

        if len(prophet_df) < 10:
            raise ValueError(
                f"Insufficient data for forecasting: {len(prophet_df)} rows (minimum 10)"
            )

        model = Prophet(
            seasonality_mode=self.config.seasonality_mode,
            changepoint_prior_scale=self.config.changepoint_prior_scale,
            interval_width=self.config.confidence_interval,
            daily_seasonality="auto",
            weekly_seasonality="auto",
            yearly_seasonality="auto",
        )

        for seasonality in self.config.custom_seasonalities:
            model.add_seasonality(**seasonality)

        model.fit(prophet_df)
        self._model = model

        future = model.make_future_dataframe(
            periods=self.config.periods,
            freq=self.config.frequency,
        )
        forecast = model.predict(future)

        points: list[ForecastPoint] = []
        history_dates = set(prophet_df["ds"].dt.to_pydatetime())

        for _, row in forecast.iterrows():
            ts = row["ds"].to_pydatetime()
            is_forecast = ts not in history_dates
            if self.config.include_history or is_forecast:
                points.append(
                    ForecastPoint(
                        timestamp=ts,
                        value=round(float(row["yhat"]), 4),
                        lower_bound=round(float(row["yhat_lower"]), 4),
                        upper_bound=round(float(row["yhat_upper"]), 4),
                        is_forecast=is_forecast,
                    )
                )

        logger.info(
            "Prophet forecast complete: %d historical + %d forecast points",
            sum(1 for p in points if not p.is_forecast),
            sum(1 for p in points if p.is_forecast),
        )
        return points

    def get_components(self) -> dict[str, Any]:
        if self._model is None:
            return {}
        return {
            "trend": "available",
            "seasonality": list(self._model.seasonalities.keys()),
            "changepoints": [str(cp) for cp in self._model.changepoints[:10]],
        }

    def _xgboost_forecast(
        self,
        df: pd.DataFrame,
        date_column: str,
        value_column: str,
    ) -> list[ForecastPoint]:
        from xgboost import XGBRegressor

        ts = df[[date_column, value_column]].copy()
        ts[date_column] = pd.to_datetime(ts[date_column])
        ts = ts.sort_values(date_column).dropna()

        ts["ordinal"] = ts[date_column].map(datetime.toordinal)
        ts["dayofweek"] = ts[date_column].dt.dayofweek
        ts["month"] = ts[date_column].dt.month
        ts["quarter"] = ts[date_column].dt.quarter

        feature_cols = ["ordinal", "dayofweek", "month", "quarter"]
        X = ts[feature_cols].values
        y = ts[value_column].values

        model = XGBRegressor(n_estimators=200, max_depth=4, learning_rate=0.05, random_state=42)
        model.fit(X, y)

        last_date = ts[date_column].max()
        freq_map = {"D": 1, "W": 7, "M": 30, "H": 1 / 24}
        delta_days = freq_map.get(self.config.frequency, 1)

        future_dates = pd.date_range(
            start=last_date + pd.Timedelta(days=delta_days),
            periods=self.config.periods,
            freq=self.config.frequency,
        )

        future_features = np.column_stack(
            [
                [d.toordinal() for d in future_dates],
                [d.dayofweek for d in future_dates],
                [d.month for d in future_dates],
                [d.quarter for d in future_dates],
            ]
        )

        predictions = model.predict(future_features)
        residual_std = float(np.std(y - model.predict(X)))
        z = 1.96  # 95% CI

        points: list[ForecastPoint] = []
        if self.config.include_history:
            history_preds = model.predict(X)
            for i, row in enumerate(ts.itertuples()):
                points.append(
                    ForecastPoint(
                        timestamp=getattr(row, date_column),
                        value=round(float(getattr(row, value_column)), 4),
                        lower_bound=round(float(history_preds[i]) - z * residual_std, 4),
                        upper_bound=round(float(history_preds[i]) + z * residual_std, 4),
                        is_forecast=False,
                    )
                )

        for date, pred in zip(future_dates, predictions, strict=False):
            points.append(
                ForecastPoint(
                    timestamp=date.to_pydatetime(),
                    value=round(float(pred), 4),
                    lower_bound=round(float(pred) - z * residual_std, 4),
                    upper_bound=round(float(pred) + z * residual_std, 4),
                    is_forecast=True,
                )
            )

        return points
