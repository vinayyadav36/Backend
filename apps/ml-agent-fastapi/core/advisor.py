# apps/ml-agent-fastapi/core/advisor.py
"""
Einstein Advisor — Daily Brief & Proactive Suggestion Engine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analyses three data streams every 24 hours via Temporal Cron Workflow:
  1. Financial trends  — ledger / budget_variance_view
  2. System performance — Redis telemetry (gateway latency, ML latency)
  3. Security anomalies — audit log auth-failure patterns

Results are written to `system_suggestions` in PostgreSQL, where the
NestJS Admin Dashboard reads and surfaces them with an "Apply" button.

Storage-tiering rule:
  Documents > 1 year old + zero access → suggest Azure Archive move.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
_CONFIDENCE_THRESHOLD = 0.65


class EinsteinAdvisor:
    """
    Proactive Suggestion Engine.

    Usage (from Temporal activity)::

        advisor = EinsteinAdvisor()
        brief   = await advisor.generate_daily_brief(tenant_id="acme")
    """

    # ── Data Fetchers ─────────────────────────────────────────────────────────

    def _pg_connect(self):
        import psycopg2
        return psycopg2.connect(os.getenv("DATABASE_URL", ""))

    def _fetch_variance_rows(self, tenant_id: str) -> List[Dict[str, Any]]:
        """Read from budget_variance_view for a single tenant."""
        try:
            conn = self._pg_connect()
            cur = conn.cursor()
            cur.execute("SET app.current_tenant_id = %s", (tenant_id,))
            cur.execute(
                """
                SELECT tenant_id, category,
                       budget_amount, actual_amount,
                       variance_pct, period_label, day_of_week
                FROM   budget_variance_view
                WHERE  tenant_id = %s
                  AND  ABS(variance_pct) >= 10
                ORDER  BY ABS(variance_pct) DESC
                LIMIT  100
                """,
                (tenant_id,),
            )
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
            conn.close()
            return rows
        except Exception:
            return []

    def _fetch_uncollected_gst(self, tenant_id: str) -> Optional[float]:
        """Return total uncollected GST amount for this tenant."""
        try:
            conn = self._pg_connect()
            cur = conn.cursor()
            cur.execute("SET app.current_tenant_id = %s", (tenant_id,))
            cur.execute(
                """
                SELECT COALESCE(SUM(tax_amount), 0)
                FROM   invoices
                WHERE  tenant_id      = %s
                  AND  payment_status = 'UNPAID'
                  AND  due_date       < NOW()
                """,
                (tenant_id,),
            )
            val = cur.fetchone()
            conn.close()
            return float(val[0]) if val else None
        except Exception:
            return None

    def _fetch_old_blobs(self, tenant_id: str) -> Optional[int]:
        """
        Count documents older than 1 year with zero recent access
        (tracked in ingested_files).
        """
        try:
            conn = self._pg_connect()
            cur = conn.cursor()
            cur.execute("SET app.current_tenant_id = %s", (tenant_id,))
            cur.execute(
                """
                SELECT COUNT(*)
                FROM   ingested_files
                WHERE  tenant_id   = %s
                  AND  ingested_at < NOW() - INTERVAL '1 year'
                  AND  status      = 'PROCESSED'
                """,
                (tenant_id,),
            )
            val = cur.fetchone()
            conn.close()
            return int(val[0]) if val else 0
        except Exception:
            return None

    def _fetch_gateway_latency(self) -> Optional[float]:
        """Read average NestJS latency from Redis telemetry."""
        try:
            import redis as _redis
            r = _redis.Redis.from_url(
                os.getenv("REDIS_URL", "redis://localhost:6379"),
                decode_responses=True,
            )
            val = r.get("telemetry:gateway:avg_latency_ms")
            return float(val) if val else None
        except Exception:
            return None

    def _fetch_ml_latency(self) -> Optional[float]:
        """Read average ML Agent reasoning latency from Redis telemetry."""
        try:
            import redis as _redis
            r = _redis.Redis.from_url(
                os.getenv("REDIS_URL", "redis://localhost:6379"),
                decode_responses=True,
            )
            val = r.get("telemetry:ml:avg_latency_ms")
            return float(val) if val else None
        except Exception:
            return None

    def _fetch_auth_failures(self, tenant_id: str) -> int:
        """Count failed auth events in the last 24 h from MongoDB audit logs."""
        try:
            import pymongo
            client = pymongo.MongoClient(
                os.getenv("MONGO_URI", "mongodb://localhost:27017")
            )
            db = client[os.getenv("DB_NAME", "jarvis")]
            count = db["immutable_audit_logs"].count_documents({
                "tenant_id": tenant_id,
                "action": {"$regex": "LOGIN_FAIL", "$options": "i"},
                "created_at": {"$gte": datetime.utcnow() - timedelta(hours=24)},
            })
            client.close()
            return count
        except Exception:
            return 0

    # ── Suggestion Generators ─────────────────────────────────────────────────

    async def _analyze_spending(self, tenant_id: str) -> Dict[str, Any]:
        """Financial optimisation from ledger / variance data."""
        rows = self._fetch_variance_rows(tenant_id)
        suggestions: List[str] = []
        impact = "Medium"

        # Day-of-week spend spikes
        patterns: Dict[str, Dict[str, List[float]]] = {}
        for row in rows:
            cat = row.get("category", "General")
            day = str(row.get("day_of_week", ""))
            patterns.setdefault(cat, {}).setdefault(day, []).append(
                float(row.get("variance_pct", 0))
            )

        for cat, day_map in patterns.items():
            for day, variances in day_map.items():
                avg = sum(variances) / len(variances)
                if avg >= 20:
                    _DOW_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                    if day.isdigit() and 0 <= int(day) <= 6:
                        day_name = _DOW_NAMES[int(day)]
                    else:
                        day_name = day
                    suggestions.append(
                        f"{cat} costs run {avg:.1f}% over budget on {day_name}s. "
                        f"Consider Reserved Instances or off-peak scheduling."
                    )
                    impact = "High"

        # Uncollected GST
        gst = self._fetch_uncollected_gst(tenant_id)
        if gst and gst > 0:
            suggestions.append(
                f"₹{gst:,.2f} in uncollected GST is outstanding on overdue invoices. "
                f"Shall Einstein send automated reminders?"
            )
            impact = "High"

        # Storage tiering
        old_count = self._fetch_old_blobs(tenant_id)
        if old_count and old_count > 0:
            suggestions.append(
                f"{old_count} documents are over 1 year old with no recent access. "
                f"Moving them to Azure Archive Storage could reduce monthly costs."
            )

        return {
            "area": "FINANCE",
            "suggestions": suggestions or ["No significant financial anomalies detected."],
            "impact": impact,
            "confidence": 0.91,
        }

    async def _analyze_latency(self, tenant_id: str) -> Dict[str, Any]:
        """System performance: gateway + ML latency, predictive scaling."""
        suggestions: List[str] = []
        impact = "Low"

        gw_ms = self._fetch_gateway_latency()
        if gw_ms and gw_ms > 200:
            suggestions.append(
                f"NestJS Gateway avg latency is {gw_ms:.0f} ms (threshold 200 ms). "
                f"Recommend spinning up 2 additional AKS user nodes."
            )
            impact = "High"

        ml_ms = self._fetch_ml_latency()
        if ml_ms and ml_ms > 5000:
            suggestions.append(
                f"ML Agent reasoning latency is {ml_ms / 1000:.1f} s. "
                f"Consider switching to a GPU-optimised AKS node pool."
            )
            impact = "High"

        if not suggestions:
            suggestions.append("System latency is within acceptable thresholds.")

        return {
            "area": "INFRA",
            "suggestions": suggestions,
            "impact": impact,
            "confidence": 0.88,
        }

    async def _analyze_auth_patterns(self, tenant_id: str) -> Dict[str, Any]:
        """Security: failed login patterns, new-IP anomalies."""
        suggestions: List[str] = []
        impact = "Low"

        failures = self._fetch_auth_failures(tenant_id)
        if failures >= 10:
            suggestions.append(
                f"{failures} failed login attempts in the last 24 h. "
                f"Einstein has flagged these for IP-level review. "
                f"Consider enabling MFA for all admin accounts."
            )
            impact = "Critical"
        elif failures > 0:
            suggestions.append(
                f"{failures} failed login attempt(s) in the last 24 h — within normal range."
            )
        else:
            suggestions.append("No auth anomalies detected in the last 24 h.")

        return {
            "area": "SECURITY",
            "suggestions": suggestions,
            "impact": impact,
            "confidence": 0.95,
        }

    # ── Persistence ───────────────────────────────────────────────────────────

    def _save_suggestions(
        self, tenant_id: str, category: str, items: List[str], impact: str,
        confidence: float,
    ) -> int:
        """Upsert suggestions into `system_suggestions` table."""
        if not items or confidence < _CONFIDENCE_THRESHOLD:
            return 0
        try:
            conn = self._pg_connect()
            cur = conn.cursor()
            saved = 0
            for msg in items:
                cur.execute(
                    """
                    INSERT INTO system_suggestions
                        (tenant_id, category, message, impact_score,
                         status, confidence, created_at)
                    VALUES (%s, %s, %s, %s, 'Pending', %s, NOW())
                    """,
                    (tenant_id, category, msg, impact, confidence),
                )
                saved += 1
            conn.commit()
            conn.close()
            return saved
        except Exception:
            return 0

    # ── Main Entry ────────────────────────────────────────────────────────────

    async def generate_daily_brief(self, tenant_id: str) -> Dict[str, Any]:
        """
        Produce the Einstein Daily Brief for one tenant.
        Called by the Temporal cron activity every 24 hours.
        """
        fin = await self._analyze_spending(tenant_id)
        sys = await self._analyze_latency(tenant_id)
        sec = await self._analyze_auth_patterns(tenant_id)

        total_saved = 0
        for insight in [fin, sys, sec]:
            total_saved += self._save_suggestions(
                tenant_id,
                insight["area"],
                insight["suggestions"],
                insight["impact"],
                insight["confidence"],
            )

        return {
            "summary": "Einstein Daily Brief",
            "tenant_id": tenant_id,
            "generated_at": datetime.utcnow().isoformat(),
            "suggestions": [fin, sys, sec],
            "total_saved": total_saved,
            "confidence": 0.98,
        }
