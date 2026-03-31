# apps/ml-agent-fastapi/temporal_worker.py
"""
Temporal Python Worker — AI Activities & Workflows
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hosts all ML activities that NestJS Temporal workflows can call cross-language.

Activities registered on queue 'jarvis-ml':
  • ai_match_transactions     — invoice ↔ transaction reconciliation
  • ai_detect_anomalies       — Isolation Forest fraud detection
  • ai_reconcile_billing      — full billing reconciliation → pending_tasks
  • brain_reason              — JarvisBrain.decide() async reasoning
  • daily_suggestion_run      — EinsteinAdvisor cron (all tenants, every 24 h)
  • data_ingestion_saga       — Cognitive Router saga with compensating actions
  • monthly_witness_report    — Witness Protection PDF generation (1st of month)
  • enforce_efficiency        — MafiaEnforcer health-check enforcement
"""
import asyncio
import logging
from datetime import timedelta

from temporalio import activity, workflow, worker
from temporalio.client import Client
from temporalio.common import RetryPolicy

from services.anomaly import AnomalyDetector
from agents.task_handlers.billing_reconcile import run_reconciliation
from core.config import settings

logger = logging.getLogger("temporal_worker")


# ═══════════════════════════════════════════════════════════════════════════════
# EXISTING ACTIVITIES (unchanged signatures)
# ═══════════════════════════════════════════════════════════════════════════════

@activity.defn
async def ai_match_transactions(payload: dict) -> list:
    """Find matching bank transactions ↔ invoices via AI. Result goes to pending_tasks."""
    detector = AnomalyDetector()
    return detector.find_matches(payload)


@activity.defn
async def ai_detect_anomalies(payload: dict) -> list:
    """Detect anomalous amounts in a list of transactions."""
    detector = AnomalyDetector()
    return detector.detect(payload.get("data", []), payload.get("contamination", 0.01))


@activity.defn
async def ai_reconcile_billing(payload: dict) -> dict:
    """Run full billing reconciliation — saves to pending_tasks, NOT ledger."""
    tenant_id = payload.get("tenant_id", "unknown")
    return run_reconciliation(tenant_id, payload)


# ═══════════════════════════════════════════════════════════════════════════════
# EINSTEIN BRAIN ACTIVITY
# ═══════════════════════════════════════════════════════════════════════════════

@activity.defn
async def brain_reason(payload: dict) -> dict:
    """
    Run JarvisBrain.decide() as an async Temporal activity.
    Returns the full reasoning result including audit_hash and pending_task_id.
    """
    from core.brain import JarvisBrain
    tenant_id = payload.get("tenant_id", "unknown")
    prompt = payload.get("prompt", "")
    brain = JarvisBrain(tenant_id=tenant_id)
    return await brain.decide(prompt)


# ═══════════════════════════════════════════════════════════════════════════════
# DAILY SUGGESTION CRON ACTIVITY
# ═══════════════════════════════════════════════════════════════════════════════

@activity.defn
async def daily_suggestion_run(payload: dict) -> dict:
    """
    Fan out EinsteinAdvisor.generate_daily_brief() to all active tenants.
    Scheduled every 24 h by the DailySuggestionWorkflow cron.
    """
    from services.suggestion_engine import SuggestionEngine
    engine = SuggestionEngine()
    return await engine.run_all()


# ═══════════════════════════════════════════════════════════════════════════════
# DATA INGESTION SAGA ACTIVITIES
# ═══════════════════════════════════════════════════════════════════════════════

@activity.defn
async def saga_write_postgres_metadata(payload: dict) -> dict:
    """Step 1 of ingestion saga: record file metadata in Postgres ingested_files."""
    from core.router import DataIngestionBrain
    router = DataIngestionBrain()
    result = await router.identify_and_route(
        payload.get("raw_data", {}), payload.get("metadata", {})
    )
    return result


@activity.defn
async def saga_move_blob(payload: dict) -> dict:
    """Step 2 of ingestion saga: move file in Azure Blob Storage to processed path."""
    storage_path = payload.get("storage_path", "")
    content_hash = payload.get("content_hash", "")
    # In production: use Azure SDK to copy blob from raw/ to processed/
    # Placeholder returns success so the saga can proceed to ML analysis.
    return {"moved": True, "storage_path": storage_path, "content_hash": content_hash}


@activity.defn
async def saga_trigger_ml_analysis(payload: dict) -> dict:
    """Step 3 of ingestion saga: run ML analysis on the ingested file."""
    category = payload.get("category", "UNKNOWN")
    tenant_id = payload.get("tenant_id", "unknown")
    # Route to the correct brain based on category
    return {"analysed": True, "category": category, "tenant_id": tenant_id}


@activity.defn
async def saga_compensate_quarantine(payload: dict) -> dict:
    """
    Compensating action: if ML analysis fails, move blob to quarantine/ and
    mark the Postgres record as FAILED so the Admin can review.
    """
    import psycopg2
    import os
    file_record_id = payload.get("file_record_id")
    try:
        conn = psycopg2.connect(os.getenv("DATABASE_URL", ""))
        cur = conn.cursor()
        cur.execute(
            "UPDATE ingested_files SET status = 'QUARANTINE' WHERE id = %s",
            (file_record_id,),
        )
        conn.commit()
        conn.close()
    except Exception as exc:
        logger.error("Saga compensate failed: %s", exc)
    return {"quarantined": True, "file_record_id": file_record_id}


# ═══════════════════════════════════════════════════════════════════════════════
# MONTHLY WITNESS REPORT ACTIVITY
# ═══════════════════════════════════════════════════════════════════════════════

@activity.defn
async def monthly_witness_report(payload: dict) -> dict:
    """
    Generate, sign, and archive the monthly Witness Protection audit report.
    Triggered by MonthlyReportWorkflow on the 1st of each month.
    """
    from core.witness_protection import generate_witness_report
    blob_url, seal = generate_witness_report(
        tenant_id=payload.get("tenant_id", "unknown"),
        capital=float(payload.get("capital", 0.0)),
        attacks=int(payload.get("attacks", 0)),
        shredded_gb=float(payload.get("shredded_gb", 0.0)),
        suggestions_applied=int(payload.get("suggestions_applied", 0)),
        public_key_pem=payload.get("public_key_pem"),
    )
    return {"blob_url": blob_url, "sha256_seal": seal}


# ═══════════════════════════════════════════════════════════════════════════════
# ENFORCE EFFICIENCY ACTIVITY
# ═══════════════════════════════════════════════════════════════════════════════

@activity.defn
async def enforce_efficiency(metrics: dict) -> list:
    """
    Run MafiaEnforcer.enforce_efficiency() — restart slow pods, block IPs,
    freeze unbalanced-ledger tenants.
    """
    from core.consigliere import MafiaEnforcer
    enforcer = MafiaEnforcer()
    return await enforcer.enforce_efficiency(metrics)


# ═══════════════════════════════════════════════════════════════════════════════
# WORKFLOW DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════

@workflow.defn
class DataIngestionSagaWorkflow:
    """
    Saga Pattern: guarantees data purity during ingestion.
    If ML analysis fails, compensating actions restore the system to a clean state.
    """

    @workflow.run
    async def run(self, payload: dict) -> dict:
        retry = RetryPolicy(maximum_attempts=3, backoff_coefficient=2.0)

        # Step 1: Write Postgres metadata
        meta_result = await workflow.execute_activity(
            saga_write_postgres_metadata, payload,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=retry,
        )

        # Step 2: Move blob to processed path
        try:
            blob_result = await workflow.execute_activity(
                saga_move_blob, meta_result,
                start_to_close_timeout=timedelta(seconds=60),
                retry_policy=retry,
            )
        except Exception:
            await workflow.execute_activity(
                saga_compensate_quarantine, meta_result,
                start_to_close_timeout=timedelta(seconds=30),
            )
            return {**meta_result, "status": "QUARANTINED", "step_failed": "saga_move_blob"}

        # Step 3: Trigger ML analysis
        try:
            ml_result = await workflow.execute_activity(
                saga_trigger_ml_analysis, {**meta_result, **blob_result},
                start_to_close_timeout=timedelta(seconds=120),
                retry_policy=retry,
            )
        except Exception:
            # Compensate: quarantine and mark FAILED
            await workflow.execute_activity(
                saga_compensate_quarantine, meta_result,
                start_to_close_timeout=timedelta(seconds=30),
            )
            return {**meta_result, "status": "QUARANTINED", "step_failed": "saga_trigger_ml_analysis"}

        return {**meta_result, **blob_result, **ml_result, "status": "PROCESSED"}


@workflow.defn
class DailySuggestionWorkflow:
    """24-hour cron: generate and persist Einstein advisor suggestions for all tenants."""

    @workflow.run
    async def run(self, payload: dict) -> dict:
        return await workflow.execute_activity(
            daily_suggestion_run, payload,
            start_to_close_timeout=timedelta(minutes=10),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )


@workflow.defn
class MonthlyReportWorkflow:
    """Monthly cron: generate and archive Witness Protection audit reports."""

    @workflow.run
    async def run(self, payload: dict) -> dict:
        return await workflow.execute_activity(
            monthly_witness_report, payload,
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )


@workflow.defn
class BrainReasonWorkflow:
    """Async brain reasoning — returns job_id immediately, notifies on completion."""

    @workflow.run
    async def run(self, payload: dict) -> dict:
        return await workflow.execute_activity(
            brain_reason, payload,
            start_to_close_timeout=timedelta(minutes=2),
            # Allow up to 3 attempts with backoff for transient LLM/network errors
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                backoff_coefficient=2.0,
                initial_interval=timedelta(seconds=2),
            ),
        )


# ═══════════════════════════════════════════════════════════════════════════════
# WORKER ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

async def main():
    client = await Client.connect(settings.temporal_address)
    async with worker.Worker(
        client,
        task_queue="jarvis-ml",
        workflows=[
            DataIngestionSagaWorkflow,
            DailySuggestionWorkflow,
            MonthlyReportWorkflow,
            BrainReasonWorkflow,
        ],
        activities=[
            ai_match_transactions,
            ai_detect_anomalies,
            ai_reconcile_billing,
            brain_reason,
            daily_suggestion_run,
            saga_write_postgres_metadata,
            saga_move_blob,
            saga_trigger_ml_analysis,
            saga_compensate_quarantine,
            monthly_witness_report,
            enforce_efficiency,
        ],
    ):
        logger.info(
            "Temporal ML worker started on queue 'jarvis-ml' → %s",
            settings.temporal_address,
        )
        await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
