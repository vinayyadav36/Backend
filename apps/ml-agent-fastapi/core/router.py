# apps/ml-agent-fastapi/core/router.py
"""
Jarvis Cognitive Router — Dynamic Data Ingestion Brain
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fingerprints incoming payloads, identifies the source application
(WhatsApp / SAP / Excel / IoT / API), classifies the content category
semantically, and routes data to the correct storage tier.

Storage routing:
  FINANCE    → PostgreSQL (ledger) + Azure Blob (immutable PDF)
  OPERATIONS → MongoDB (operational state)
  LEGAL      → Azure Blob (immutable) + PostgreSQL (compliance metadata)
  UNKNOWN    → quarantine/ (held for human review)

The Postgres `ingested_files` meta-table tracks every file's location
so the Fetch API always knows exactly where to find it.
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

# ── Category keyword registry ─────────────────────────────────────────────────

CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "FINANCE": [
        "ledger", "invoice", "gst", "tax", "debit", "credit", "payment",
        "reconcil", "receipt", "billing", "revenue", "expense", "journal",
        "account", "balance", "cashflow", "transaction", "voucher", "remittance",
    ],
    "OPERATIONS": [
        "inventory", "room_status", "booking", "occupancy", "restock",
        "vendor", "sla", "ticket", "asset", "maintenance", "schedule",
        "room", "hotel", "check_in", "check_out", "housekeeping",
    ],
    "LEGAL": [
        "contract", "consent", "compliance", "gdpr", "nda", "agreement",
        "policy", "regulation", "terms", "privacy", "audit", "clause",
        "dpdp", "kyc", "aml",
    ],
}

# ── Source fingerprint patterns ───────────────────────────────────────────────

SOURCE_PATTERNS: Dict[str, List[str]] = {
    "quickbooks":  ["quickbooks", "qbo", "intuit"],
    "sap":         ["sap", "s4hana", "sap_order", "sap_invoice"],
    "whatsapp":    ["whatsapp", "wa_message", "waid"],
    "excel":       [".xlsx", ".xls", "spreadsheet", "excel"],
    "iot_sensor":  ["sensor_id", "device_id", "iot", "telemetry", "reading"],
    "user_upload": ["upload", "multipart", "file_name"],
    "api":         [],   # default fallback
}

# ── Storage routing map ───────────────────────────────────────────────────────

STORAGE_TARGETS: Dict[str, Dict[str, str]] = {
    "FINANCE": {
        "primary": "postgres:ledger",
        "blob":    "azure-blob:finance-immutable",
        "prefix":  "processed/finance",
    },
    "OPERATIONS": {
        "primary": "mongodb:operations",
        "blob":    "azure-blob:ops-state",
        "prefix":  "processed/operations",
    },
    "LEGAL": {
        "primary": "postgres:compliance",
        "blob":    "azure-blob:legal-immutable",
        "prefix":  "processed/legal",
    },
    "UNKNOWN": {
        "primary": "quarantine",
        "blob":    "azure-blob:quarantine",
        "prefix":  "quarantine",
    },
}


class DataIngestionBrain:
    """
    Cognitive Router: fingerprints data, categorises it semantically,
    and routes it to the correct storage and processing path.
    """

    def __init__(self):
        self._llm = None  # lazy-loaded on first classify

    # ── Source Fingerprinting ─────────────────────────────────────────────────

    def _detect_source(self, metadata: Dict[str, Any]) -> str:
        """Identify the originating system from header / metadata values."""
        haystack = " ".join(
            str(v).lower() for v in metadata.values()
        ) + " " + " ".join(k.lower() for k in metadata.keys())

        for source, signals in SOURCE_PATTERNS.items():
            if signals and any(s in haystack for s in signals):
                return source
        return "api"

    # ── Keyword Categorisation ────────────────────────────────────────────────

    def _keyword_classify(self, text: str) -> str:
        """Rule-based keyword scan. Returns the category with the most hits."""
        lower = text.lower()
        scores: Dict[str, int] = {cat: 0 for cat in CATEGORY_KEYWORDS}
        for category, keywords in CATEGORY_KEYWORDS.items():
            for kw in keywords:
                if kw in lower:
                    scores[category] += 1
        best = max(scores, key=lambda c: scores[c])
        return best if scores[best] > 0 else "UNKNOWN"

    # ── LLM Semantic Categorisation ───────────────────────────────────────────

    async def _classify_content(self, data: Any) -> str:
        """
        Two-stage classification:
          1. Fast keyword scan (no LLM cost)
          2. LLM fallback for ambiguous payloads (inspects first 500 chars)
        """
        snippet = (
            json.dumps(data, default=str)[:500]
            if not isinstance(data, str)
            else data[:500]
        )

        # Fast path
        result = self._keyword_classify(snippet)
        if result != "UNKNOWN":
            return result

        # LLM fallback
        try:
            from langchain_openai import ChatOpenAI
            if self._llm is None:
                self._llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
            categories = ", ".join(CATEGORY_KEYWORDS.keys())
            response = await self._llm.ainvoke(
                f"Classify the following data snippet into one of [{categories}] "
                f"or UNKNOWN. Reply with only the category name.\n\nData: {snippet}"
            )
            candidate = response.content.strip().upper()
            return candidate if candidate in CATEGORY_KEYWORDS else "UNKNOWN"
        except Exception:
            return "UNKNOWN"

    # ── Postgres Meta-Table ───────────────────────────────────────────────────

    def _record_file_location(
        self,
        tenant_id: str,
        original_path: str,
        processed_path: str,
        category: str,
        source: str,
        file_hash: str,
    ) -> Optional[str]:
        """
        Upsert file-location metadata into `ingested_files` so the Fetch API
        always knows where to find a document after it has been auto-arranged.
        Returns the record ID or None on failure.
        """
        try:
            import psycopg2
            conn = psycopg2.connect(os.getenv("DATABASE_URL", ""))
            cur = conn.cursor()
            cur.execute("SET app.current_tenant_id = %s", (tenant_id,))
            cur.execute(
                """
                INSERT INTO ingested_files
                    (tenant_id, source_app, category, original_path,
                     processed_path, file_hash, status, ingested_at)
                VALUES (%s, %s, %s, %s, %s, %s, 'PROCESSED', NOW())
                ON CONFLICT (file_hash, tenant_id) DO UPDATE
                    SET processed_path = EXCLUDED.processed_path,
                        status         = 'REPROCESSED',
                        ingested_at    = NOW()
                RETURNING id::text
                """,
                (
                    tenant_id, source, category,
                    original_path, processed_path, file_hash,
                ),
            )
            record_id = cur.fetchone()[0]
            conn.commit()
            conn.close()
            return record_id
        except Exception:
            return None

    # ── Main Router ───────────────────────────────────────────────────────────

    async def identify_and_route(
        self, raw_data: Any, metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        OODA Router:
          Observe  — detect source application
          Orient   — classify content category (keyword → LLM)
          Decide   — compute storage path and targets
          Act      — persist meta-table entry, return routing envelope
        """
        tenant_id = metadata.get("tenant_id", "unknown")

        # 1. Source Fingerprinting
        source_app = self._detect_source(metadata)

        # 2. Semantic Categorisation
        category = await self._classify_content(raw_data)

        # 3. Storage routing
        targets = STORAGE_TARGETS.get(category, STORAGE_TARGETS["UNKNOWN"])
        year_month = datetime.utcnow().strftime("%Y/%m")
        storage_path = (
            f"/{targets['prefix']}/{year_month}/{tenant_id}/{source_app}"
        )

        # 4. Content fingerprint for idempotency / deduplication
        content_hash = hashlib.sha256(
            json.dumps(raw_data, default=str, sort_keys=True).encode()
        ).hexdigest()

        original_path = metadata.get(
            "original_path", f"raw/incoming/{source_app}"
        )

        # 5. Record in Postgres meta-table (best-effort)
        record_id = self._record_file_location(
            tenant_id, original_path, storage_path,
            category, source_app, content_hash,
        )

        action = "AUTO_ARRANGE" if category != "UNKNOWN" else "QUARANTINE"

        return {
            "source": source_app,
            "category": category,
            "storage_targets": targets,
            "storage_path": storage_path,
            "content_hash": content_hash,
            "file_record_id": record_id,
            "action": action,
            "tenant_id": tenant_id,
            "timestamp": datetime.utcnow().isoformat(),
        }
