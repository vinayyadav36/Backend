# apps/ml-agent-fastapi/services/forecast.py
"""
Revenue / Occupancy Forecasting using Facebook Prophet.
Falls back to a simple moving-average when Prophet is unavailable.
"""
from typing import List, Dict, Any


class ForecastService:
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id

    def run_prediction(self, history: list, days: int) -> List[Dict[str, Any]]:
        """
        Predict future values.
        history: list of {"ds": "YYYY-MM-DD", "y": float}
        Returns a list of {"ds": date_str, "yhat": float, "yhat_lower": float, "yhat_upper": float}
        """
        try:
            import pandas as pd
            from prophet import Prophet

            df = pd.DataFrame(history)
            df["ds"] = pd.to_datetime(df["ds"])

            model = Prophet(daily_seasonality=True, yearly_seasonality=True)
            model.fit(df)

            future = model.make_future_dataframe(periods=days)
            forecast = model.predict(future)

            predictions = forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(days)
            return [
                {
                    "ds": str(row["ds"].date()),
                    "yhat": round(row["yhat"], 2),
                    "yhat_lower": round(row["yhat_lower"], 2),
                    "yhat_upper": round(row["yhat_upper"], 2),
                }
                for _, row in predictions.iterrows()
            ]
        except ImportError:
            return self._moving_average_fallback(history, days)

    def _moving_average_fallback(self, history: list, days: int) -> List[Dict[str, Any]]:
        """Simple 7-day moving average when Prophet is not installed."""
        from datetime import date, timedelta

        values = [float(p.get("y", 0)) for p in history]
        window = min(7, len(values))
        avg = sum(values[-window:]) / window if window else 0

        today = date.today()
        return [
            {
                "ds": str(today + timedelta(days=i + 1)),
                "yhat": round(avg, 2),
                "yhat_lower": round(avg * 0.9, 2),
                "yhat_upper": round(avg * 1.1, 2),
            }
            for i in range(days)
        ]
