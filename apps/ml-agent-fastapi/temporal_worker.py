# apps/ml-agent-fastapi/temporal_worker.py
"""
Temporal Python Worker — AI Activities
Hosts ML activities that NestJS Temporal workflows can call cross-language.
"""
import asyncio
from temporalio import activity, worker
from temporalio.client import Client

from services.anomaly import AnomalyDetector
from agents.task_handlers.billing_reconcile import run_reconciliation
from core.config import settings


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


async def main():
    client = await Client.connect(settings.temporal_address)
    async with worker.Worker(
        client,
        task_queue="jarvis-ml",
        activities=[ai_match_transactions, ai_detect_anomalies, ai_reconcile_billing],
    ):
        print(f"Temporal ML worker started on queue 'jarvis-ml' → {settings.temporal_address}")
        await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
