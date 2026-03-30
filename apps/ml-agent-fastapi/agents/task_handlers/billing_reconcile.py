# apps/ml-agent-fastapi/agents/task_handlers/billing_reconcile.py
"""
Billing Reconciliation Agent
━━━━━━━━━━━━━━━━━━━━━━━━━━━
SAFETY RULE: This agent may ONLY write to the `pending_tasks` MongoDB collection.
It is NEVER allowed to write directly to `journal_entries` or `ledger_lines`.
Human approval (via the NestJS automation controller) is required before any
ledger commit takes place.
"""
from typing import Dict, Any, List
import pymongo
import os
from datetime import datetime

from services.anomaly import AnomalyDetector


def save_pending_task(tenant_id: str, suggestions: List[Dict[str, Any]], source: str = "ai_reconcile") -> str:
    """
    Save AI reconciliation suggestions to `pending_tasks` for human review.
    Returns the inserted document ID.
    """
    client = pymongo.MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
    db = client[os.getenv("DB_NAME", "jarvis")]

    doc = {
        "tenant_id": tenant_id,
        "source": source,
        "status": "awaiting_approval",   # Only humans change this to 'approved'
        "suggestions": suggestions,
        "created_at": datetime.utcnow(),
    }
    result = db["pending_tasks"].insert_one(doc)
    client.close()
    return str(result.inserted_id)


def run_reconciliation(tenant_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Match bank transactions to invoices and persist suggestions to pending_tasks.
    Returns a summary — never writes to the ledger directly.
    """
    detector = AnomalyDetector()
    matches = detector.find_matches(payload)

    task_id = save_pending_task(tenant_id, matches)

    return {
        "tenant_id": tenant_id,
        "pending_task_id": task_id,
        "match_count": len(matches),
        "status": "awaiting_approval",
        "message": "AI suggestions saved to pending_tasks. A manager must approve before ledger commit.",
    }
