# apps/ml-agent-fastapi/main.py
"""
Jarvis AI Microservice — Unified Entry Point
Deliverable C + Refined Brain Model (IQ/EQ/AQ)
"""
from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

from models.schemas      import ForecastRequest, QueryRequest, AnomalyRequest
from models.brain_schemas import (
    CashFlowRequest, ReconcileRequest, VarianceRequest,
    FunnelRequest, CACLTVRequest, CampaignForecastRequest,
    SentimentRequest, SegmentRequest, BudgetReallocationRequest,
    LeadScoreRequest, PipelineRequest, PricingRequest, ContractRequest,
    InventoryRequest, VendorRequest, SLARequest, RestockRequest,
    DashboardRequest, ScenarioRequest,
)

from services.forecast      import ForecastService
from services.rag_service   import RAGService
from services.anomaly       import AnomalyDetector
from services.finance_brain import CashFlowBrain, ReconciliationBrain, VarianceAlertEngine
from services.marketing_brain import (
    FunnelAnalyzer, CACLTVCalculator, CampaignROIForecaster,
    SentimentAnalyzer, AudienceSegmenter, BudgetReallocationEngine,
)
from services.sales_brain   import LeadScoringBrain, PipelineForecaster, DynamicPricingEngine, SmartContractGenerator
from services.ops_brain     import InventoryOptimiser, VendorLeadTimePredictor, SLAMonitor, RestockingWorkflow
from services.super_agent   import EnterpriseSuperAgent
from core.config            import settings

app = FastAPI(title="Jarvis AI Microservice", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── OpenTelemetry ─────────────────────────────────────────────────────────────
if settings.otlp_endpoint:
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        provider = TracerProvider()
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otlp_endpoint)))
        FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
    except ImportError:
        pass


# ── Multi-tenancy dependency ──────────────────────────────────────────────────
async def get_tenant_id(x_tenant_id: str = Header(...)) -> str:
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="x-tenant-id header missing")
    return x_tenant_id


# ═════════════════════════════════════════════════════════════════════════════
# HEALTH
# ═════════════════════════════════════════════════════════════════════════════
@app.get("/health")
async def health():
    return {"status": "ok", "service": "jarvis-ml", "version": "2.0.0"}


# ═════════════════════════════════════════════════════════════════════════════
# ORIGINAL ML ROUTES (Deliverable C)
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/ai/forecast/revenue")
async def forecast_revenue(req: ForecastRequest, tenant_id: str = Depends(get_tenant_id)):
    if not req.history_data:
        raise HTTPException(status_code=400, detail="Historical data required")
    svc = ForecastService(tenant_id)
    history = [{"ds": p.ds, "y": p.y} for p in req.history_data]
    return {
        "tenant_id": tenant_id,
        "horizon_days": req.days,
        "predictions": svc.run_prediction(history, req.days),
        "confidence": 0.85,
        "currency": "INR",
    }


@app.post("/ai/agent/ask")
async def jarvis_ask(req: QueryRequest, tenant_id: str = Depends(get_tenant_id)):
    return await RAGService(tenant_id).query_knowledge_base(req.question)


@app.post("/anomaly")
async def detect_anomaly(req: AnomalyRequest, tenant_id: str = Depends(get_tenant_id)):
    if len(req.data) < 5:
        raise HTTPException(status_code=400, detail="Need ≥5 data points")
    anomalies = AnomalyDetector().detect(req.data, req.contamination)
    return {"tenant_id": tenant_id, "total_records": len(req.data), "anomaly_count": len(anomalies), "anomalies": anomalies}


@app.post("/lead/score")
async def score_lead_simple(req: dict, tenant_id: str = Depends(get_tenant_id)):
    score = min(1.0, sum(float(v) for v in req.values() if isinstance(v, (int, float))) / 100)
    return {"tenant_id": tenant_id, "score": round(score, 4), "label": "HOT" if score > 0.7 else "WARM" if score > 0.4 else "COLD"}


@app.post("/ai/agent/run")
async def run_agent(req: dict, tenant_id: str = Depends(get_tenant_id)):
    task = req.get("task", "")
    return await RAGService(tenant_id).query_knowledge_base(f"Task: {task}. Context: {req.get('payload', {})}")


# ═════════════════════════════════════════════════════════════════════════════
# FINANCE BRAIN  (CFO-level precision)
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/finance/forecast")
async def finance_forecast(req: CashFlowRequest, tenant_id: str = Depends(get_tenant_id)):
    brain = CashFlowBrain(tenant_id)
    history = [{"ds": p.ds, "y": p.y} for p in req.history]
    return brain.forecast(history, req.horizon_days, req.scenario)


@app.post("/finance/reconcile")
async def finance_reconcile(req: ReconcileRequest, tenant_id: str = Depends(get_tenant_id)):
    brain = ReconciliationBrain()
    matches = brain.match(req.transactions, req.invoices)
    # Save to pending_tasks — NEVER writes to journal_entries
    from agents.task_handlers.billing_reconcile import save_pending_task
    task_id = save_pending_task(tenant_id, matches, source="ai_reconcile")
    return {
        "tenant_id": tenant_id,
        "pending_task_id": task_id,
        "match_count": len(matches),
        "matches": matches,
        "status": "awaiting_approval",
        "note": "Matches saved to pending_tasks. Manager approval required before ledger commit.",
    }


@app.post("/finance/variance")
async def finance_variance(req: VarianceRequest, tenant_id: str = Depends(get_tenant_id)):
    return VarianceAlertEngine().analyse(req.budget, req.actual, req.threshold_pct)


# ═════════════════════════════════════════════════════════════════════════════
# MARKETING BRAIN  (CMO-level creativity)
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/marketing/funnel")
async def marketing_funnel(req: FunnelRequest, tenant_id: str = Depends(get_tenant_id)):
    return FunnelAnalyzer().analyse(req.leads)


@app.post("/marketing/cac-ltv")
async def marketing_cac_ltv(req: CACLTVRequest, tenant_id: str = Depends(get_tenant_id)):
    return CACLTVCalculator().calculate(req.model_dump())


@app.post("/marketing/campaign-roi")
async def marketing_campaign_roi(req: CampaignForecastRequest, tenant_id: str = Depends(get_tenant_id)):
    return CampaignROIForecaster().forecast(req.model_dump())


@app.post("/marketing/sentiment")
async def marketing_sentiment(req: SentimentRequest, tenant_id: str = Depends(get_tenant_id)):
    if not req.texts:
        raise HTTPException(status_code=400, detail="At least one text required")
    return SentimentAnalyzer().analyse(req.texts)


@app.post("/marketing/segment")
async def marketing_segment(req: SegmentRequest, tenant_id: str = Depends(get_tenant_id)):
    return AudienceSegmenter().segment(req.customers, req.n_clusters)


@app.post("/marketing/budget-reallocation")
async def marketing_budget_realloc(req: BudgetReallocationRequest, tenant_id: str = Depends(get_tenant_id)):
    return BudgetReallocationEngine().suggest(req.channels)


# ═════════════════════════════════════════════════════════════════════════════
# SALES BRAIN  (CRO-level persuasion)
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/sales/lead-score")
async def sales_lead_score(req: LeadScoreRequest, tenant_id: str = Depends(get_tenant_id)):
    scored = LeadScoringBrain().score_batch(req.leads)
    return {"tenant_id": tenant_id, "total": len(scored), "leads": scored}


@app.post("/sales/pipeline")
async def sales_pipeline(req: PipelineRequest, tenant_id: str = Depends(get_tenant_id)):
    return PipelineForecaster().forecast(req.deals)


@app.post("/sales/pricing")
async def sales_pricing(req: PricingRequest, tenant_id: str = Depends(get_tenant_id)):
    engine = DynamicPricingEngine()
    return {"tenant_id": tenant_id, "suggestions": [engine.suggest(p) for p in req.products]}


@app.post("/sales/contract")
async def sales_contract(req: ContractRequest, tenant_id: str = Depends(get_tenant_id)):
    contract = SmartContractGenerator().generate(req.model_dump())
    # Immutably log contract generation
    from agents.task_handlers.billing_reconcile import save_pending_task
    save_pending_task(tenant_id, [{"contract_id": contract["contract_id"], "hash": contract["immutable_hash"]}], source="contract_generated")
    return contract


# ═════════════════════════════════════════════════════════════════════════════
# OPERATIONS BRAIN  (COO-level efficiency)
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/operations/inventory")
async def ops_inventory(req: InventoryRequest, tenant_id: str = Depends(get_tenant_id)):
    return InventoryOptimiser().optimise(req.inventory, req.sales_pipeline_signal, req.cash_flow_signal)


@app.post("/operations/vendor-leadtime")
async def ops_vendor(req: VendorRequest, tenant_id: str = Depends(get_tenant_id)):
    return VendorLeadTimePredictor().predict(req.vendors)


@app.post("/operations/sla")
async def ops_sla(req: SLARequest, tenant_id: str = Depends(get_tenant_id)):
    return SLAMonitor().analyse(req.tickets)


@app.post("/operations/restock")
async def ops_restock(req: RestockRequest, tenant_id: str = Depends(get_tenant_id)):
    return RestockingWorkflow().generate_orders(req.restock_items, tenant_id)


# ═════════════════════════════════════════════════════════════════════════════
# ENTERPRISE SUPER-AGENT  (IQ + EQ + AQ)
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/super-agent/dashboard")
async def super_agent_dashboard(req: DashboardRequest, tenant_id: str = Depends(get_tenant_id)):
    """
    Single endpoint — runs all four brains, shares cross-department signals,
    returns unified executive KPIs + boardroom alerts.
    """
    agent = EnterpriseSuperAgent(tenant_id)
    payload = req.model_dump()
    # Convert TimeSeriesPoint dicts back to plain dicts
    return agent.executive_dashboard(payload)


@app.post("/super-agent/scenario")
async def super_agent_scenario(req: ScenarioRequest, tenant_id: str = Depends(get_tenant_id)):
    """
    What-if scenario simulation: run base, optimistic, pessimistic, stress_test
    and compare outcomes side-by-side.
    """
    agent = EnterpriseSuperAgent(tenant_id)
    return agent.scenario_simulation(req.base_payload.model_dump(), req.scenarios)
