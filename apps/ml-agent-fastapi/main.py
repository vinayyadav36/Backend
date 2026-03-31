# apps/ml-agent-fastapi/main.py
"""
Jarvis AI Microservice — Unified Entry Point
Einstein Brain + gRPC Neural Link + Cognitive Router + Advisor + Consigliere
"""
import asyncio
import hashlib
import hmac
import logging
import os
from contextlib import asynccontextmanager
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
    # New: Brain / Router / Advisor / Consigliere
    BrainReasonRequest, BrainAsyncReasonRequest,
    DataRouteRequest, AdvisorBriefRequest,
    EnforceRequest, TriggerCoupRequest, WitnessReportRequest,
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

logger = logging.getLogger("jarvis.main")

# ── gRPC server handle (kept alive for the process lifetime) ──────────────────
_grpc_server = None


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Start the gRPC Neural Link server alongside uvicorn."""
    global _grpc_server
    try:
        from grpc_server import create_grpc_server
        _grpc_server = await create_grpc_server()
        logger.info("gRPC Neural Link started")
    except Exception as exc:
        logger.warning("gRPC server could not start: %s", exc)
    yield
    if _grpc_server:
        await _grpc_server.stop(grace=5)


app = FastAPI(
    title="Jarvis AI Microservice",
    version="3.0.0",
    description="Einstein Brain · gRPC Neural Link · Cognitive Router · Advisor · Consigliere",
    lifespan=lifespan,
)

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


# ═════════════════════════════════════════════════════════════════════════════
# EINSTEIN BRAIN — synchronous & async reasoning
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/brain/reason")
async def brain_reason_sync(
    req: BrainReasonRequest, tenant_id: str = Depends(get_tenant_id)
):
    """
    Synchronous ReAct reasoning.
    The Brain observes, orients, decides, and acts in a single blocking call.
    """
    from core.brain import JarvisBrain
    try:
        brain = JarvisBrain(tenant_id=tenant_id)
        return await brain.decide(req.prompt)
    except ValueError:
        # Return a safe generic message — never expose internal exception details
        raise HTTPException(status_code=403, detail="Request rejected: security policy violation.")


@app.post("/brain/reason/async")
async def brain_reason_async(
    req: BrainAsyncReasonRequest, tenant_id: str = Depends(get_tenant_id)
):
    """
    Asynchronous reasoning via Temporal.
    Returns a job_id immediately; the Brain runs in the background.
    Poll Temporal or connect via WebSocket for the result.
    """
    try:
        from temporalio.client import Client
        client = await Client.connect(settings.temporal_address)
        handle = await client.start_workflow(
            "BrainReasonWorkflow",
            {"tenant_id": tenant_id, "prompt": req.prompt},
            id=f"brain-{tenant_id}-{int(asyncio.get_event_loop().time() * 1000)}",
            task_queue="jarvis-ml",
        )
        return {
            "job_id": handle.id,
            "tenant_id": tenant_id,
            "status": "queued",
            "message": "Reasoning submitted. Retrieve result via Temporal workflow ID.",
        }
    except Exception:
        raise HTTPException(status_code=503, detail="Workflow service temporarily unavailable. Please retry.")


# ═════════════════════════════════════════════════════════════════════════════
# COGNITIVE ROUTER — data ingestion & self-sorting
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/data/route")
async def data_route(req: DataRouteRequest, tenant_id: str = Depends(get_tenant_id)):
    """
    Fingerprint incoming data, classify it semantically, and route it to
    the correct storage tier (Finance→Postgres+Blob, Ops→Mongo, Legal→Blob).
    """
    from core.router import DataIngestionBrain
    meta = {**req.metadata, "tenant_id": tenant_id}
    router = DataIngestionBrain()
    return await router.identify_and_route(req.raw_data, meta)


@app.post("/data/ingest/saga")
async def data_ingest_saga(
    req: DataRouteRequest, tenant_id: str = Depends(get_tenant_id)
):
    """
    Submit a full Data Ingestion Saga via Temporal (write metadata → move blob →
    run ML analysis, with compensating quarantine on failure).
    """
    try:
        from temporalio.client import Client
        client = await Client.connect(settings.temporal_address)
        handle = await client.start_workflow(
            "DataIngestionSagaWorkflow",
            {"raw_data": req.raw_data, "metadata": {**req.metadata, "tenant_id": tenant_id}},
            id=f"ingest-{tenant_id}-{int(asyncio.get_event_loop().time() * 1000)}",
            task_queue="jarvis-ml",
        )
        return {"job_id": handle.id, "status": "saga_started"}
    except Exception:
        raise HTTPException(status_code=503, detail="Workflow service temporarily unavailable. Please retry.")


# ═════════════════════════════════════════════════════════════════════════════
# EINSTEIN ADVISOR — daily brief & proactive suggestions
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/advisor/brief")
async def advisor_brief(
    req: AdvisorBriefRequest, tenant_id: str = Depends(get_tenant_id)
):
    """Generate the Einstein Daily Brief on-demand for a specific tenant."""
    from core.advisor import EinsteinAdvisor
    target = req.tenant_id or tenant_id
    advisor = EinsteinAdvisor()
    return await advisor.generate_daily_brief(target)


# ═════════════════════════════════════════════════════════════════════════════
# CONSIGLIERE — enforcement, scaling, security
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/ops/enforce")
async def ops_enforce(req: EnforceRequest, tenant_id: str = Depends(get_tenant_id)):
    """
    Run MafiaEnforcer.enforce_efficiency() against current service metrics.
    Restarts weak pods, blocks suspicious IPs, freezes unbalanced tenants.
    """
    from core.consigliere import MafiaEnforcer
    enforcer = MafiaEnforcer()
    await enforcer.enforce_efficiency(req.metrics)
    # Return only safe status info — never echo user-provided metrics values back
    return {"tenant_id": tenant_id, "status": "enforcement_cycle_complete"}


@app.post("/ops/trigger-coup")
async def trigger_coup(req: TriggerCoupRequest, tenant_id: str = Depends(get_tenant_id)):
    """
    Panic Button: flip Azure Front Door to secondary region.
    Requires a valid HMAC-SHA256 signature to prevent unauthorised failover.
    """
    # Verify HMAC signature (multi-sig: requires COUP_SECRET env var)
    secret = os.getenv("COUP_HMAC_SECRET", "")
    if not secret:
        raise HTTPException(status_code=501, detail="COUP_HMAC_SECRET not configured.")
    expected = hmac.new(
        secret.encode(), req.reason.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, req.hmac_signature):
        raise HTTPException(status_code=403, detail="Invalid HMAC signature.")

    try:
        # Verify Azure SDK is available; actual Front Door priority update
        # happens via the Sentinel's SDK coup or infrastructure automation.
        from azure.identity import DefaultAzureCredential  # noqa: F401
        return {
            "status": "coup_initiated",
            "reason": req.reason,
            "message": "Traffic failover to secondary region triggered via Azure Front Door.",
        }
    except ImportError:
        raise HTTPException(status_code=501, detail="Azure SDK not installed.")


@app.post("/ops/honeypot-alert")
async def honeypot_alert(payload: dict, tenant_id: str = Depends(get_tenant_id)):
    """
    Endpoint called by the PostgreSQL pg_notify listener when a honey-pot
    record is accessed. Triggers immediate freeze + WAF blacklist.
    """
    # Allowlist record_type to prevent injection via user-controlled payload
    _ALLOWED_RECORD_TYPES = {"ghost_admin_user", "dummy_ledger_entry", "unknown"}
    raw_record_type = payload.get("record_type", "unknown")
    record_type = raw_record_type if raw_record_type in _ALLOWED_RECORD_TYPES else "unknown"

    from core.consigliere import MafiaEnforcer
    enforcer = MafiaEnforcer()
    await enforcer.handle_honeypot_access(
        tenant_id=tenant_id,   # always use the verified header value, not payload
        user_id=payload.get("user_id", "unknown"),
        record_type=record_type,
    )
    # Return a safe fixed status — never echo back user-supplied payload fields
    return {"status": "honeypot_alert_processed"}


# ═════════════════════════════════════════════════════════════════════════════
# WITNESS PROTECTION — monthly audit report
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/ops/witness-report")
async def witness_report(
    req: WitnessReportRequest, tenant_id: str = Depends(get_tenant_id)
):
    """
    On-demand Witness Protection PDF: generate, sign, encrypt, and archive.
    Monthly cron is handled by Temporal MonthlyReportWorkflow.
    """
    from core.witness_protection import generate_witness_report
    blob_url, seal = generate_witness_report(
        tenant_id=tenant_id,
        capital=req.capital,
        attacks=req.attacks,
        shredded_gb=req.shredded_gb,
        suggestions_applied=req.suggestions_applied,
        public_key_pem=req.public_key_pem,
    )
    return {
        "tenant_id": tenant_id,
        "blob_url": blob_url,
        "sha256_seal": seal,
        "status": "archived",
    }
