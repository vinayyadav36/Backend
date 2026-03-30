"""
JARVIS AI Microservice
Revenue Forecasting (Prophet) + Anomaly Detection (Isolation Forest)
"""

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd

app = FastAPI(title="JARVIS AI Microservice", version="1.0.0")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class TimePoint(BaseModel):
    ds: str   # ISO date string, e.g. "2024-01-15"
    y: float  # metric value


class ForecastRequest(BaseModel):
    data: List[TimePoint]
    horizon: int = 30


class TransactionPoint(BaseModel):
    amount: float
    date: Optional[str] = None
    description: Optional[str] = None


class AnomalyRequest(BaseModel):
    data: List[TransactionPoint]
    contamination: float = 0.01


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "service": "jarvis-ml"}


# ---------------------------------------------------------------------------
# Revenue Forecasting  (Deliverable C)
# ---------------------------------------------------------------------------

@app.post("/forecast")
async def forecast(
    payload: ForecastRequest,
    x_tenant_id: str = Header(..., description="Tenant identifier"),
):
    """
    Forecast future revenue using Facebook Prophet.
    Requires at least 2 historical data points.
    """
    if len(payload.data) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 data points for forecasting")

    try:
        from prophet import Prophet

        df = pd.DataFrame([{"ds": p.ds, "y": p.y} for p in payload.data])
        df["ds"] = pd.to_datetime(df["ds"])

        model = Prophet()
        model.fit(df)

        future = model.make_future_dataframe(periods=payload.horizon)
        result = model.predict(future)

        forecast_rows = result[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(payload.horizon)
        return {
            "tenant_id": x_tenant_id,
            "horizon": payload.horizon,
            "forecast": [
                {
                    "ds": str(row["ds"].date()),
                    "yhat": round(row["yhat"], 2),
                    "yhat_lower": round(row["yhat_lower"], 2),
                    "yhat_upper": round(row["yhat_upper"], 2),
                }
                for _, row in forecast_rows.iterrows()
            ],
        }
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Prophet library not installed. Run: pip install prophet",
        )


# ---------------------------------------------------------------------------
# Anomaly / Fraud Detection  (Deliverable C)
# ---------------------------------------------------------------------------

@app.post("/anomaly")
async def detect_anomaly(
    payload: AnomalyRequest,
    x_tenant_id: str = Header(..., description="Tenant identifier"),
):
    """
    Detect anomalous transactions using Isolation Forest.
    Returns only flagged (anomalous) records.
    """
    if len(payload.data) < 5:
        raise HTTPException(status_code=400, detail="Need at least 5 data points for anomaly detection")

    try:
        from sklearn.ensemble import IsolationForest

        amounts = [[p.amount] for p in payload.data]
        contamination = max(0.001, min(float(payload.contamination), 0.5))

        preds = IsolationForest(contamination=contamination, random_state=42).fit_predict(amounts)

        anomalies = [
            payload.data[i].dict()
            for i, p in enumerate(preds)
            if p == -1
        ]

        return {
            "tenant_id": x_tenant_id,
            "total_records": len(payload.data),
            "anomaly_count": len(anomalies),
            "anomalies": anomalies,
        }
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="scikit-learn not installed. Run: pip install scikit-learn",
        )
