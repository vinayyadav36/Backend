# apps/ml-agent-fastapi/services/suggestion_engine.py
"""
Admin Suggestion Engine — driven by the Temporal 24-hour Cron Workflow.
Wraps EinsteinAdvisor.generate_daily_brief() for all active tenants
and also writes infrastructure-level hints to `system_suggestions`.
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List


class SuggestionEngine:
    """
    Thin orchestration layer that discovers active tenants and fans out
    to EinsteinAdvisor for each one.
    """

    def _get_active_tenants(self) -> List[str]:
        """Return the list of tenant IDs that have had activity in the last 30 days."""
        try:
            import psycopg2
            conn = psycopg2.connect(os.getenv("DATABASE_URL", ""))
            cur = conn.cursor()
            cur.execute(
                """
                SELECT DISTINCT tenant_id
                FROM   journal_entries
                WHERE  created_at >= NOW() - INTERVAL '30 days'
                LIMIT  500
                """
            )
            rows = [r[0] for r in cur.fetchall()]
            conn.close()
            return rows
        except Exception:
            return []

    async def run_all(self) -> Dict[str, Any]:
        """
        Fan out daily brief generation to every active tenant.
        Called by the Temporal `daily_suggestion_run` activity.
        """
        from core.advisor import EinsteinAdvisor
        advisor = EinsteinAdvisor()

        tenants = self._get_active_tenants()
        results: List[Dict[str, Any]] = []

        for tenant_id in tenants:
            try:
                brief = await advisor.generate_daily_brief(tenant_id)
                results.append({
                    "tenant_id": tenant_id,
                    "status": "ok",
                    "saved": brief.get("total_saved", 0),
                })
            except Exception as exc:
                results.append({
                    "tenant_id": tenant_id,
                    "status": "error",
                    "detail": str(exc),
                })

        return {
            "run_at": datetime.utcnow().isoformat(),
            "tenants_processed": len(tenants),
            "results": results,
        }
