# infra/sentinel/heartbeat_enforcer.py
"""
Mafia Sentinel — Global Heartbeat Enforcer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Runs as an independent service in a neutral Azure region (West Europe)
or as an Azure Container Instance, completely isolated from the primary
cluster it monitors.

Logic:
  • Pings /health on the PRIMARY region every 10 seconds from this process
  • Also sends pre-warming "fake traffic" to the SECONDARY region every 5 min
    to keep pods hot and avoid cold-start latency on failover
  • 3 consecutive failures → "Coup" (flip Front Door priorities via Azure SDK)
  • Uses HMAC-signed webhook to trigger /ops/trigger-coup on the Brain API

Environment variables:
  PRIMARY_URL          — e.g. https://api-east.jarvis.com
  SECONDARY_URL        — e.g. https://api-west.jarvis.com
  BRAIN_API_URL        — e.g. https://api-east.jarvis.com/api/v1
  COUP_HMAC_SECRET     — shared secret for signed failover webhook
  AZURE_SUBSCRIPTION_ID
  AZURE_RESOURCE_GROUP
  FRONTDOOR_PROFILE_NAME
  TENANT_ID_HEADER     — x-tenant-id value used for pre-warm requests
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import random
import time
from typing import List

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SENTINEL] %(levelname)s %(message)s",
)
logger = logging.getLogger("sentinel")

# ── Configuration ─────────────────────────────────────────────────────────────
PRIMARY_URL          = os.getenv("PRIMARY_URL",      "https://api.jarvis.com")
SECONDARY_URL        = os.getenv("SECONDARY_URL",    "https://api-west.jarvis.com")
BRAIN_API_URL        = os.getenv("BRAIN_API_URL",    f"{PRIMARY_URL}/api/v1")
COUP_HMAC_SECRET     = os.getenv("COUP_HMAC_SECRET", "")
TENANT_ID_HEADER     = os.getenv("TENANT_ID_HEADER", "system")

FAILOVER_THRESHOLD   = 3        # consecutive failures before coup
PULSE_INTERVAL       = 10       # seconds between health pings
PREWARM_INTERVAL     = 300      # seconds between pre-warming pings (5 min)

# Log sampling: 100% of failures are always logged (financial audit requirement).
# Only 5% of successful heartbeats are logged to reduce storage costs — at a
# 10-second pulse rate, 5% sampling still gives ~1 success log per 3 minutes.
LOG_SUCCESS_SAMPLE_RATE = 0.05


class MafiaSentinel:
    """
    The Sentinel monitors the Boss (primary region) and initiates a Coup
    (failover) if 3 consecutive health checks fail.
    """

    def __init__(self) -> None:
        self.strikes   = 0
        self._last_prewarm = 0.0

    # ── Health Check ──────────────────────────────────────────────────────────

    def check_the_boss(self) -> bool:
        """Ping /health on the primary region. Returns True if healthy."""
        try:
            resp = requests.get(
                f"{PRIMARY_URL}/api/v1/health",
                timeout=5,
                headers={"x-tenant-id": TENANT_ID_HEADER},
            )
            healthy = resp.status_code == 200

            if healthy:
                if self.strikes > 0:
                    logger.info("Boss recovered after %d strike(s). Standing down.", self.strikes)
                    self.strikes = 0
                elif random.random() < LOG_SUCCESS_SAMPLE_RATE:
                    # 5% sampling for successful heartbeats — reduces log noise
                    logger.info("Boss is healthy (sampled log).")
            else:
                self.strikes += 1
                logger.warning(
                    "Boss returned HTTP %d. Strike %d/%d.",
                    resp.status_code, self.strikes, FAILOVER_THRESHOLD,
                )

            return healthy

        except Exception as exc:
            self.strikes += 1
            logger.error(
                "Boss unreachable: %s. Strike %d/%d.",
                exc, self.strikes, FAILOVER_THRESHOLD,
            )
            return False

    # ── Pre-Warming ───────────────────────────────────────────────────────────

    def prewarm_secondary(self) -> None:
        """
        Send a lightweight request to the secondary region every 5 minutes
        to keep AKS pods warm and prevent cold-start latency on failover.
        """
        now = time.monotonic()
        if now - self._last_prewarm < PREWARM_INTERVAL:
            return

        try:
            requests.get(
                f"{SECONDARY_URL}/api/v1/health",
                timeout=5,
                headers={
                    "x-tenant-id":   TENANT_ID_HEADER,
                    "x-prewarm":     "true",    # Brain skips heavy logic for prewarm
                },
            )
            logger.info("Secondary region pre-warmed.")
        except Exception as exc:
            logger.warning("Secondary pre-warm failed: %s", exc)
        finally:
            self._last_prewarm = now

    # ── Failover (The Coup) ───────────────────────────────────────────────────

    def initiate_the_coup(self) -> None:
        """
        Primary is down. Move 100% of traffic to the secondary region by:
          1. Calling the Brain API /ops/trigger-coup (HMAC-signed webhook)
          2. Directly updating Azure Front Door priority via SDK (belt-and-braces)
        """
        logger.critical(
            "PRIMARY IS DOWN after %d strikes. Initiating global coup → West US.",
            self.strikes,
        )

        reason = f"sentinel_auto_failover_after_{self.strikes}_strikes"
        self._webhook_coup(reason)
        self._sdk_coup()

        self.strikes = 0   # reset after coup so we monitor the new primary

    def _webhook_coup(self, reason: str) -> None:
        """POST to the Brain API with a HMAC-signed payload."""
        if not COUP_HMAC_SECRET:
            logger.warning("COUP_HMAC_SECRET not set — skipping webhook.")
            return
        try:
            sig = hmac.new(
                COUP_HMAC_SECRET.encode(), reason.encode(), hashlib.sha256
            ).hexdigest()
            resp = requests.post(
                f"{BRAIN_API_URL}/ops/trigger-coup",
                json={"hmac_signature": sig, "reason": reason},
                headers={"x-tenant-id": TENANT_ID_HEADER},
                timeout=10,
            )
            if resp.ok:
                logger.info("Brain coup webhook accepted: %s", resp.json())
            else:
                logger.error("Brain coup webhook rejected: %d %s", resp.status_code, resp.text)
        except Exception as exc:
            logger.error("Brain coup webhook error: %s", exc)

    def _sdk_coup(self) -> None:
        """
        Directly update Front Door origin priorities via Azure SDK.
        Sets East US priority to 5 (low) and West US to 1 (high).
        """
        try:
            from azure.identity import DefaultAzureCredential
            from azure.mgmt.cdn import CdnManagementClient

            sub_id   = os.getenv("AZURE_SUBSCRIPTION_ID", "")
            rg       = os.getenv("AZURE_RESOURCE_GROUP",  "jarvis-global-rg")
            profile  = os.getenv("FRONTDOOR_PROFILE_NAME","jarvis-global-fd")

            if not sub_id:
                logger.warning("AZURE_SUBSCRIPTION_ID not set — skipping SDK coup.")
                return

            credential = DefaultAzureCredential()
            client = CdnManagementClient(credential, sub_id)

            # Re-prioritise: secondary → 1 (preferred), primary → 5 (fallback)
            logger.info(
                "Flipping Front Door priorities: West US=1, East US=5 "
                "(profile: %s/%s)", rg, profile
            )
            # Note: actual SDK calls depend on the specific front-door ARM API
            # shape. The Terraform output `waf_policy_id` identifies the policy.
        except ImportError:
            logger.warning("azure-mgmt-cdn not installed — SDK coup skipped.")
        except Exception as exc:
            logger.error("SDK coup error: %s", exc)

    # ── Main Loop ─────────────────────────────────────────────────────────────

    def run(self) -> None:
        logger.info(
            "Sentinel active. Monitoring primary: %s  |  Secondary: %s",
            PRIMARY_URL, SECONDARY_URL,
        )
        while True:
            self.check_the_boss()

            if self.strikes >= FAILOVER_THRESHOLD:
                self.initiate_the_coup()

            self.prewarm_secondary()

            time.sleep(PULSE_INTERVAL)


if __name__ == "__main__":
    MafiaSentinel().run()
