# apps/ml-agent-fastapi/main.py
"""
Jarvis AI Microservice — Entry Point
Deliverable C: Revenue Forecasting, RAG, Anomaly Detection, Lead Scoring
"""
from fastapi import FastAPI, Header, HTTPException, Depends
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from models.schemas import ForecastRequest, QueryRequest, AnomalyRequest, LeadScoreRequest, AgentRequest, ReconcileRequest
from services.forecast import ForecastService
from services.rag_service import RAGService
from services.anomaly import AnomalyDetector
from core.config import settings

import os

app = FastAPI(title="Jarvis AI Microservice", version="1.0.0")

# ── OpenTelemetry ────────────────────────────────────────────────────────────
if settings.otlp_endpoint:
    try:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        provider = TracerProvider()
        processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otlp_endpoint))
        provider.add_span_processor(processor)
        FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
    except ImportError:
        pass  # OpenTelemetry optional in dev


# ── Multi-tenancy dependency ─────────────────────────────────────────────────
async def get_tenant_id(x_tenant_id: str = Header(...)) -> str:
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="x-tenant-id header missing")
    return x_tenant_id


# ── Health ───────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "jarvis-ml", "version": "1.0.0"}


# ── Revenue Forecast (Prophet / Moving Average fallback) ─────────────────────
@app.post("/ai/forecast/revenue")
async def forecast_revenue(req: ForecastRequest, tenant_id: str = Depends(get_tenant_id)):
    if not req.history_data:
        raise HTTPException(status_code=400, detail="Historical data required")
    service = ForecastService(tenant_id)
    history = [{"ds": p.ds, "y": p.y} for p in req.history_data]
    predictions = service.run_prediction(history, req.days)
    return {
        "tenant_id": tenant_id,
        "horizon_days": req.days,
        "predictions": predictions,
        "confidence": 0.85,
        "currency": "INR",
    }


# ── RAG: Jarvis Knowledge Base Q&A ──────────────────────────────────────────
@app.post("/ai/agent/ask")
async def jarvis_ask(req: QueryRequest, tenant_id: str = Depends(get_tenant_id)):
    rag = RAGService(tenant_id)
    return await rag.query_knowledge_base(req.question)


# ── Anomaly / Fraud Detection ────────────────────────────────────────────────
@app.post("/anomaly")
async def detect_anomaly(req: AnomalyRequest, tenant_id: str = Depends(get_tenant_id)):
    if len(req.data) < 5:
        raise HTTPException(status_code=400, detail="Need ≥5 data points for anomaly detection")
    detector = AnomalyDetector()
    anomalies = detector.detect(req.data, req.contamination)
    return {
        "tenant_id": tenant_id,
        "total_records": len(req.data),
        "anomaly_count": len(anomalies),
        "anomalies": anomalies,
    }


# ── Lead Scoring ─────────────────────────────────────────────────────────────
@app.post("/lead/score")
async def score_lead(req: LeadScoreRequest, tenant_id: str = Depends(get_tenant_id)):
    # Placeholder — swap in a trained sklearn/XGBoost model
    score = min(1.0, sum(float(v) for v in req.features.values() if isinstance(v, (int, float))) / 100)
    return {"tenant_id": tenant_id, "score": round(score, 4), "label": "HOT" if score > 0.7 else "WARM" if score > 0.4 else "COLD"}


# ── Generic Agent Run ─────────────────────────────────────────────────────────
@app.post("/ai/agent/run")
async def run_agent(req: AgentRequest, tenant_id: str = Depends(get_tenant_id)):
    rag = RAGService(tenant_id)
    return await rag.query_knowledge_base(f"Task: {req.task}. Context: {req.payload}")
