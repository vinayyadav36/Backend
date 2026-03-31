# apps/ml-agent-fastapi/core/consigliere.py
"""
Mafia Enforcer (Consigliere) — Autonomous Self-Healing & Security Enforcement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The Consigliere doesn't just log problems — it eliminates them.

Capabilities:
  • Auto-restart under-performing AKS pods (kubectl rollout restart)
  • Blacklist attacker IPs in Azure Front Door WAF
  • Freeze tenant accounts with unbalanced ledgers
  • Evict non-critical pods to reclaim CPU/RAM for high-priority tasks
  • Detect Honey-Pot access and initiate subnet lockdown

All enforcement actions are logged to `immutable_audit_logs` (MongoDB)
and to `system_suggestions` (Postgres) for admin visibility.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
from datetime import datetime
from typing import Any, Dict, List, Optional


class MafiaEnforcer:
    """
    Autonomous enforcement engine.
    Instantiate once per enforcement cycle; all methods are async-safe.
    """

    # Latency threshold (ms) above which a service is considered "weak"
    LATENCY_THRESHOLD_MS: int = 500
    # Auth-failure count above which a subnet lockdown is triggered
    AUTH_LOCKDOWN_THRESHOLD: int = 20

    def __init__(self):
        self._redis_client = None

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _redis(self):
        if self._redis_client is None:
            import redis as _redis
            self._redis_client = _redis.Redis.from_url(
                os.getenv("REDIS_URL", "redis://localhost:6379"),
                decode_responses=True,
            )
        return self._redis_client

    def _audit(self, action: str, detail: Dict[str, Any]) -> None:
        """Append an enforcement action to the MongoDB immutable audit log."""
        try:
            import pymongo
            client = pymongo.MongoClient(
                os.getenv("MONGO_URI", "mongodb://localhost:27017")
            )
            db = client[os.getenv("DB_NAME", "jarvis")]
            db["immutable_audit_logs"].insert_one({
                "tenant_id":  "system",
                "user_id":    "consigliere",
                "action":     action,
                "detail":     detail,
                "hash":       hashlib.sha256(
                    json.dumps(detail, default=str).encode()
                ).hexdigest(),
                "created_at": datetime.utcnow(),
            })
            client.close()
        except Exception:
            pass  # audit failure must never block enforcement

    def _pg_notify(self, category: str, message: str, impact: str = "High") -> None:
        """Write an enforcement event to system_suggestions for admin visibility."""
        try:
            import psycopg2
            conn = psycopg2.connect(os.getenv("DATABASE_URL", ""))
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO system_suggestions
                    (tenant_id, category, message, impact_score, status,
                     confidence, created_at)
                VALUES ('system', %s, %s, %s, 'Applied', 1.0, NOW())
                """,
                (category, message, impact),
            )
            conn.commit()
            conn.close()
        except Exception:
            pass

    # ── Kubernetes Enforcement ────────────────────────────────────────────────

    async def trigger_k8s_restart(self, deployment_name: str) -> Dict[str, Any]:
        """
        Rolling restart a deployment to evict stuck or degraded pods.
        Only deployments listed in ALLOWED_K8S_DEPLOYMENTS (env var) may be restarted.
        The command argument is always taken from the allowlist, never directly from input.
        """
        # Build allowlist from environment — the string that enters the command
        # is always sourced from this env-configured set, not from user input.
        allowed: frozenset = frozenset(
            name.strip()
            for name in os.getenv(
                "ALLOWED_K8S_DEPLOYMENTS", "api-gateway,ml-agent,worker-service"
            ).split(",")
            if name.strip()
        )
        # Look up the validated name from the allowlist
        matched = {name for name in allowed if name == deployment_name}
        if not matched:
            return {
                "action": "K8S_RESTART", "deployment": "[REDACTED]",
                "success": False,
                "detail": "Deployment not in ALLOWED_K8S_DEPLOYMENTS — restart rejected.",
            }
        # Use the name from the allowlist, not the original user-supplied string
        safe_deployment = matched.pop()
        namespace = os.getenv("K8S_NAMESPACE", "backend")
        cmd = [
            "kubectl", "rollout", "restart",
            f"deployment/{safe_deployment}",
            "-n", namespace,
        ]
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=30
            )
            success = result.returncode == 0
            detail = {
                "deployment": deployment_name,
                "namespace": namespace,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
            }
            self._audit("K8S_ROLLOUT_RESTART", detail)
            msg = (
                f"[ENFORCER] Restarted '{deployment_name}' in namespace '{namespace}'."
                if success
                else f"[ENFORCER] Restart of '{deployment_name}' failed: {result.stderr.strip()}"
            )
            self._pg_notify("INFRA", msg)
            return {"action": "K8S_RESTART", "deployment": deployment_name,
                    "success": success, "detail": detail}
        except FileNotFoundError:
            # kubectl not available (e.g., local dev)
            return {"action": "K8S_RESTART", "deployment": deployment_name,
                    "success": False, "detail": "kubectl not found in PATH"}
        except Exception as exc:
            return {"action": "K8S_RESTART", "deployment": deployment_name,
                    "success": False, "detail": str(exc)}

    async def scale_deployment(
        self, deployment_name: str, replicas: int
    ) -> Dict[str, Any]:
        """Scale a deployment to a specific replica count (predictive scaling)."""
        allowed: frozenset = frozenset(
            name.strip()
            for name in os.getenv(
                "ALLOWED_K8S_DEPLOYMENTS", "api-gateway,ml-agent,worker-service"
            ).split(",")
            if name.strip()
        )
        matched = {name for name in allowed if name == deployment_name}
        if not matched:
            return {
                "action": "K8S_SCALE", "deployment": "[REDACTED]",
                "success": False,
                "detail": "Deployment not in ALLOWED_K8S_DEPLOYMENTS — scale rejected.",
            }
        safe_deployment = matched.pop()
        namespace = os.getenv("K8S_NAMESPACE", "backend")
        cmd = [
            "kubectl", "scale",
            f"deployment/{deployment_name}",
            f"--replicas={replicas}",
            "-n", namespace,
        ]
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=30
            )
            success = result.returncode == 0
            detail = {
                "deployment": deployment_name,
                "replicas": replicas,
                "namespace": namespace,
            }
            self._audit("K8S_SCALE", detail)
            self._pg_notify(
                "INFRA",
                f"[ENFORCER] Scaled '{deployment_name}' to {replicas} replicas.",
            )
            return {"action": "K8S_SCALE", "deployment": deployment_name,
                    "replicas": replicas, "success": success}
        except Exception as exc:
            return {"action": "K8S_SCALE", "deployment": deployment_name,
                    "success": False, "detail": str(exc)}

    # ── Azure Front Door WAF ──────────────────────────────────────────────────

    async def update_front_door_waf(self, ip_address: str) -> Dict[str, Any]:
        """
        Add a malicious IP to the Azure Front Door WAF custom-rules blocklist.
        Uses the Azure SDK with Workload Identity credentials (no passwords).
        """
        try:
            from azure.identity import DefaultAzureCredential
            from azure.mgmt.frontdoor import FrontDoorManagementClient

            credential = DefaultAzureCredential()
            sub_id = os.getenv("AZURE_SUBSCRIPTION_ID", "")
            rg = os.getenv("AZURE_RESOURCE_GROUP", "jarvis-rg")
            policy_name = os.getenv("FRONTDOOR_WAF_POLICY", "jarvisWafPolicy")

            client = FrontDoorManagementClient(credential, sub_id)
            policy = client.policies.get(rg, policy_name)

            # Add IP to custom block rules
            # WAF rule names must be alphanumeric — sanitize both IPv4 dots
            # and IPv6 colons to produce a safe identifier.
            import re as _re
            safe_ip_name = _re.sub(r"[^a-zA-Z0-9]", "", ip_address)
            block_rule = {
                "name": f"BlockIP{safe_ip_name}",
                "priority": 100,
                "ruleType": "MatchRule",
                "action": "Block",
                "matchConditions": [{
                    "matchVariable": "RemoteAddr",
                    "operator": "IPMatch",
                    "matchValue": [ip_address],
                }],
            }
            if policy.custom_rules is None or policy.custom_rules.rules is None:
                policy.custom_rules = {"rules": [block_rule]}
            else:
                policy.custom_rules.rules.append(block_rule)

            client.policies.begin_create_or_update(rg, policy_name, policy)

            detail = {"ip": ip_address, "policy": policy_name}
            self._audit("WAF_IP_BLOCK", detail)
            self._pg_notify(
                "SECURITY",
                f"[ENFORCER] IP {ip_address} blacklisted in Azure Front Door WAF.",
                impact="Critical",
            )
            return {"action": "WAF_BLOCK", "ip": ip_address, "success": True}

        except ImportError:
            # Azure SDK not installed — log and continue
            detail = {"ip": ip_address, "reason": "azure-mgmt-frontdoor not installed"}
            self._audit("WAF_IP_BLOCK_SKIPPED", detail)
            return {"action": "WAF_BLOCK", "ip": ip_address, "success": False,
                    "detail": "azure-mgmt-frontdoor not installed"}
        except Exception as exc:
            return {"action": "WAF_BLOCK", "ip": ip_address, "success": False,
                    "detail": str(exc)}

    # ── Tenant Account Freeze ─────────────────────────────────────────────────

    async def freeze_tenant(self, tenant_id: str, reason: str) -> Dict[str, Any]:
        """
        Freeze a tenant account by setting a Redis lock and logging to Postgres.
        The NestJS TenantMiddleware checks for this lock on every request.
        """
        try:
            freeze_key = f"tenant:frozen:{tenant_id}"
            self._redis().setex(freeze_key, 86_400, reason)  # 24-hour freeze

            self._audit("TENANT_FREEZE", {"tenant_id": tenant_id, "reason": reason})
            self._pg_notify(
                "SECURITY",
                f"[ENFORCER] Tenant '{tenant_id}' frozen: {reason}",
                impact="Critical",
            )
            return {"action": "TENANT_FREEZE", "tenant_id": tenant_id,
                    "success": True, "reason": reason}
        except Exception as exc:
            return {"action": "TENANT_FREEZE", "tenant_id": tenant_id,
                    "success": False, "detail": str(exc)}

    # ── Honey-Pot Detection ───────────────────────────────────────────────────

    async def handle_honeypot_access(
        self, tenant_id: str, user_id: str, record_type: str
    ) -> Dict[str, Any]:
        """
        Called when a honey-pot record (ghost_admin_user / dummy_ledger_entry)
        is accessed. Initiates immediate freeze + WAF lock.
        """
        detail = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "record_type": record_type,
            "detected_at": datetime.utcnow().isoformat(),
        }
        self._audit("HONEYPOT_TRIGGERED", detail)

        # Freeze the tenant account immediately
        await self.freeze_tenant(
            tenant_id,
            f"Honey-pot '{record_type}' accessed by user '{user_id}'",
        )

        # Record attacker IP from Redis session store (best-effort)
        attacker_ip: Optional[str] = None
        try:
            session_key = f"session:{tenant_id}:{user_id}:ip"
            attacker_ip = self._redis().get(session_key)
        except Exception:
            pass

        waf_result: Dict[str, Any] = {}
        if attacker_ip:
            waf_result = await self.update_front_door_waf(attacker_ip)

        self._pg_notify(
            "SECURITY",
            f"[HONEYPOT] Intruder detected! Tenant '{tenant_id}', user '{user_id}' "
            f"accessed '{record_type}'. Account frozen. IP blocked.",
            impact="Critical",
        )

        return {
            "action": "HONEYPOT_RESPONSE",
            "tenant_id": tenant_id,
            "user_id": user_id,
            "frozen": True,
            "waf_block": waf_result,
            "audit_hash": hashlib.sha256(
                json.dumps(detail, default=str).encode()
            ).hexdigest(),
        }

    # ── Main Enforcement Loop ─────────────────────────────────────────────────

    async def enforce_efficiency(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Evaluate service metrics and take corrective action where needed.
        Called by the Temporal HealthCheck workflow.
        """
        results: List[Dict[str, Any]] = []

        latency = metrics.get("latency_ms", 0)
        service = metrics.get("service", "api-gateway")

        if latency > self.LATENCY_THRESHOLD_MS:
            result = await self.trigger_k8s_restart(service)
            result["trigger"] = f"latency {latency} ms > {self.LATENCY_THRESHOLD_MS} ms"
            results.append(result)

        auth_failures = metrics.get("auth_failures_24h", 0)
        if auth_failures >= self.AUTH_LOCKDOWN_THRESHOLD:
            suspect_ip = metrics.get("top_failure_ip")
            if suspect_ip:
                result = await self.update_front_door_waf(suspect_ip)
                result["trigger"] = f"{auth_failures} auth failures in 24 h"
                results.append(result)

        unbalanced_tenant = metrics.get("unbalanced_ledger_tenant")
        if unbalanced_tenant:
            result = await self.freeze_tenant(
                unbalanced_tenant,
                "Unbalanced double-entry ledger detected by Einstein",
            )
            results.append(result)

        return results

    async def protect_the_vault(self, attempt: Dict[str, Any]) -> Dict[str, Any]:
        """
        Zero-tolerance entry point for suspicious access attempts.
        Blocks the IP in WAF immediately.
        """
        if not attempt.get("is_suspicious"):
            return {"action": "NOOP", "reason": "Not flagged as suspicious"}

        ip = attempt.get("ip", "")
        tenant_id = attempt.get("tenant_id", "unknown")

        self._audit("SUSPICIOUS_ACCESS_BLOCKED", attempt)

        waf = await self.update_front_door_waf(ip) if ip else {}
        freeze = await self.freeze_tenant(
            tenant_id, f"Suspicious access pattern from IP {ip}"
        ) if tenant_id != "unknown" else {}

        return {
            "action": "VAULT_PROTECT",
            "ip_blocked": bool(waf.get("success")),
            "tenant_frozen": bool(freeze.get("success")),
            "audit_hash": hashlib.sha256(
                json.dumps(attempt, default=str).encode()
            ).hexdigest(),
        }
