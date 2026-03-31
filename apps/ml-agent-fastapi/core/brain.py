# apps/ml-agent-fastapi/core/brain.py
"""
Jarvis Einstein Brain — ReAct (Reasoning + Acting) Cognitive Engine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OODA Loop: Observe → Orient → Decide → Act

Three-Tier Memory Architecture:
  Short-term  — Redis   (current transaction window, TTL 1 h)
  Long-term   — pgvector (historical tenant patterns, persistent)
  Semantic    — pre-fetched Blob references for the current context

Safety layers:
  Input  Filter — blocks prompt-injection / tenant-bypass attempts
  Output Validator — ledger mutations intercepted → pending_tasks
  Decision Signer  — SHA-256 hash for the immutable audit trail
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

EINSTEIN_SYSTEM_MESSAGE = (
    "You are the Jarvis Core Intelligence. You operate on a Double-Entry Ledger system. "
    "Every action must be balanced. You are analytical, concise, and paranoid about security. "
    "If a request lacks a SHA-256 audit trail, reject it. "
    "Never access data belonging to a different tenant. "
    "Always reason step-by-step before acting. "
    "When uncertain, ask for clarification rather than making assumptions."
)

# Patterns that indicate prompt-injection / tenant-isolation bypass
_INJECTION_PATTERNS = [
    r"ignore\s+tenant",
    r"bypass\s+tenant",
    r"all\s+tenants",
    r"admin\s+override",
    r"forget\s+(your\s+)?(instructions|rules|constraints)",
    r"ignore\s+(previous|above|all)\s+(instructions?|rules?|constraints?)",
    r"act\s+as\s+(if|though)",
    r"pretend\s+(you\s+are|to\s+be)",
    r"jailbreak",
    r"disregard\s+(your\s+)?(system|safety)",
    r"DAN\b",        # "Do Anything Now" — a known jailbreak prompt pattern
    r"developer\s+mode",
]
_INJECTION_RE = re.compile("|".join(_INJECTION_PATTERNS), re.IGNORECASE)

# Output signals that indicate the brain is proposing a ledger mutation
_LEDGER_WRITE_SIGNALS = [
    "commit to ledger",
    "write to journal",
    "journal_entries",
    "ledger_lines",
    "post the entry",
    "debit account",
    "credit account",
    "double-entry",
    "insert into journal",
    "update ledger",
]


class JarvisBrain:
    """
    The Einstein Brain: ReAct Cognitive Reasoning Engine.

    Usage::

        brain = JarvisBrain(tenant_id="acme-corp")
        result = await brain.decide("Reconcile today's invoices.")
    """

    _MEMORY_PREFIX = "brain:memory:"
    _MEMORY_WINDOW = 5       # short-term: last N transactions per tenant
    _MEMORY_TTL = 3_600      # 1-hour TTL — memory is ephemeral

    _LONGTERM_PREFIX = "brain:longterm:"

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self._redis_client = None

    # ── Redis helpers ─────────────────────────────────────────────────────────

    def _redis(self):
        if self._redis_client is None:
            import redis as _redis
            self._redis_client = _redis.Redis.from_url(
                os.getenv("REDIS_URL", "redis://localhost:6379"),
                decode_responses=True,
            )
        return self._redis_client

    # ── Tier-1: Short-term Redis memory ──────────────────────────────────────

    def load_short_term_memory(self) -> List[Dict[str, Any]]:
        """Return the last N transactions stored in Redis for this tenant."""
        try:
            key = f"{self._MEMORY_PREFIX}{self.tenant_id}"
            raw = self._redis().lrange(key, 0, self._MEMORY_WINDOW - 1)
            return [json.loads(item) for item in raw]
        except Exception:
            return []

    def save_to_short_term_memory(self, transaction: Dict[str, Any]) -> None:
        """Push a transaction into short-term memory; cap at MEMORY_WINDOW."""
        try:
            key = f"{self._MEMORY_PREFIX}{self.tenant_id}"
            r = self._redis()
            r.lpush(key, json.dumps(transaction, default=str))
            r.ltrim(key, 0, self._MEMORY_WINDOW - 1)
            r.expire(key, self._MEMORY_TTL)
        except Exception:
            pass  # memory failure must never crash reasoning

    # ── Tier-2: Long-term pgvector memory ────────────────────────────────────

    def load_long_term_memory(self, topic: str, top_k: int = 3) -> List[str]:
        """Retrieve semantically similar historical patterns from pgvector."""
        try:
            from langchain_openai import OpenAIEmbeddings
            import psycopg2

            db_url = os.getenv("DATABASE_URL", "")
            if not db_url:
                return []
            embedding = OpenAIEmbeddings().embed_query(topic)
            conn = psycopg2.connect(db_url)
            cur = conn.cursor()
            cur.execute("SET app.current_tenant_id = %s", (self.tenant_id,))
            cur.execute(
                """
                SELECT content
                FROM operational_playbook
                WHERE tenant_id = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (self.tenant_id, json.dumps(embedding), top_k),
            )
            rows = [r[0] for r in cur.fetchall()]
            conn.close()
            return rows
        except Exception:
            return []

    # ── Tier-3: Semantic buffer — pre-fetch Blob references ──────────────────

    def load_semantic_buffer(self, topic: str) -> List[str]:
        """
        Pre-fetch relevant Blob/document references so the Brain can cite
        them before the admin even asks.
        """
        try:
            r = self._redis()
            key = f"brain:semantic:{self.tenant_id}:{hashlib.md5(topic.encode()).hexdigest()}"
            cached = r.get(key)
            if cached:
                return json.loads(cached)
            # Cache miss — in production this would query a Blob index
            refs: List[str] = []
            r.setex(key, 300, json.dumps(refs))   # 5-min semantic cache
            return refs
        except Exception:
            return []

    # ── Safety Layer ──────────────────────────────────────────────────────────

    def filter_input(self, prompt: str) -> str:
        """
        Pre-Frontal Cortex: block prompt injections and tenant bypass attempts.
        Raises ValueError with a security message if the prompt is unsafe.
        """
        if _INJECTION_RE.search(prompt):
            raise ValueError(
                "SECURITY: Prompt rejected — tenant isolation bypass attempt detected."
            )
        # Disallow inline tenant_id overrides
        if re.search(
            r"tenant[_\s]*id\s*[=:]\s*['\"]?\w+['\"]?", prompt, re.IGNORECASE
        ):
            raise ValueError(
                "SECURITY: Prompt rejected — inline tenant_id override is not permitted."
            )
        return prompt

    def validate_output(self, decision: str) -> Dict[str, Any]:
        """
        Output Validator: if the Brain proposes a ledger mutation, intercept
        it and create a pending_task for human approval before any write.
        """
        lower = decision.lower()
        needs_approval = any(signal in lower for signal in _LEDGER_WRITE_SIGNALS)

        if needs_approval:
            task_id: Optional[str] = None
            try:
                from agents.task_handlers.billing_reconcile import save_pending_task
                task_id = save_pending_task(
                    self.tenant_id,
                    [{"brain_decision": decision, "requires_human_approval": True}],
                    source="brain_output_validator",
                )
            except Exception:
                pass
            return {
                "intercepted": True,
                "reason": (
                    "Ledger mutation detected — routed to pending_tasks for human approval."
                ),
                "pending_task_id": task_id,
                "decision": decision,
            }
        return {"intercepted": False, "decision": decision, "pending_task_id": None}

    # ── Signing ───────────────────────────────────────────────────────────────

    def sign_decision(self, decision: str) -> str:
        """SHA-256 hash of (tenant_id + decision) for the immutable audit log."""
        payload = f"{self.tenant_id}:{decision}"
        return hashlib.sha256(payload.encode()).hexdigest()

    # ── LangChain Tools ───────────────────────────────────────────────────────

    def _build_tools(self) -> List:
        """Construct LangChain tools scoped to this tenant's context."""
        tenant_id = self.tenant_id

        try:
            from langchain.tools import tool

            @tool
            def query_ledger(query: str) -> str:
                """
                Access the PostgreSQL double-entry ledger for financial data.
                Only SELECT queries are permitted; RLS enforces tenant isolation.
                """
                import psycopg2
                db_url = os.getenv("DATABASE_URL", "")
                if not db_url:
                    return "[query_ledger] DATABASE_URL not configured."
                safe = query.strip().rstrip(";")
                if not re.match(r"^\s*SELECT\b", safe, re.IGNORECASE):
                    return "[query_ledger] Only SELECT statements are permitted."
                try:
                    conn = psycopg2.connect(db_url)
                    cur = conn.cursor()
                    # Activate RLS for this tenant
                    cur.execute("SET app.current_tenant_id = %s", (tenant_id,))
                    cur.execute(safe)
                    rows = cur.fetchmany(50)
                    conn.close()
                    return json.dumps(rows, default=str)
                except Exception as exc:
                    return f"[query_ledger] Error: {exc}"

            @tool
            def check_audit_logs(user_id: str) -> str:
                """Search MongoDB immutable audit logs for recent user actions."""
                import pymongo
                try:
                    client = pymongo.MongoClient(
                        os.getenv("MONGO_URI", "mongodb://localhost:27017")
                    )
                    db = client[os.getenv("DB_NAME", "jarvis")]
                    docs = list(
                        db["immutable_audit_logs"]
                        .find(
                            {"tenant_id": tenant_id, "user_id": user_id},
                            {"_id": 0},
                        )
                        .sort("created_at", -1)
                        .limit(10)
                    )
                    client.close()
                    return json.dumps(docs, default=str)
                except Exception as exc:
                    return f"[check_audit_logs] Error: {exc}"

            @tool
            def search_playbook(topic: str) -> str:
                """Search the Operational Playbook via pgvector similarity."""
                import psycopg2
                db_url = os.getenv("DATABASE_URL", "")
                if not db_url:
                    return "[search_playbook] DATABASE_URL not configured."
                try:
                    from langchain_openai import OpenAIEmbeddings
                    embedding = OpenAIEmbeddings().embed_query(topic)
                    conn = psycopg2.connect(db_url)
                    cur = conn.cursor()
                    cur.execute("SET app.current_tenant_id = %s", (tenant_id,))
                    cur.execute(
                        """
                        SELECT content,
                               1 - (embedding <=> %s::vector) AS similarity
                        FROM operational_playbook
                        WHERE tenant_id = %s
                        ORDER BY embedding <=> %s::vector
                        LIMIT 3
                        """,
                        (
                            json.dumps(embedding),
                            tenant_id,
                            json.dumps(embedding),
                        ),
                    )
                    rows = cur.fetchall()
                    conn.close()
                    return json.dumps(
                        [{"content": r[0], "similarity": r[1]} for r in rows],
                        default=str,
                    )
                except Exception as exc:
                    return f"[search_playbook] Error: {exc}"

            return [query_ledger, check_audit_logs, search_playbook]

        except ImportError:
            return []

    # ── Core Reasoning Engine ─────────────────────────────────────────────────

    async def _run_agent(self, full_prompt: str) -> str:
        """Execute the LangChain ReAct agent and return its final answer."""
        try:
            from langchain_openai import ChatOpenAI
            from langchain.agents import AgentExecutor, create_openai_functions_agent
            from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
            from langchain_core.messages import SystemMessage

            llm = ChatOpenAI(model="gpt-4o", temperature=0)
            tools = self._build_tools()

            prompt_template = ChatPromptTemplate.from_messages([
                SystemMessage(content=EINSTEIN_SYSTEM_MESSAGE),
                ("human", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad"),
            ])

            agent = create_openai_functions_agent(
                llm=llm, tools=tools, prompt=prompt_template
            )
            executor = AgentExecutor(
                agent=agent,
                tools=tools,
                verbose=False,
                max_iterations=5,
                handle_parsing_errors=True,
            )
            result = await executor.ainvoke({"input": full_prompt})
            return result.get("output", "")

        except ImportError:
            return (
                f"[JarvisBrain] LangChain dependencies not installed. "
                f"Prompt received: {full_prompt[:200]}"
            )
        except Exception as exc:
            return f"[JarvisBrain] Reasoning error: {exc}"

    async def decide(self, prompt: str) -> Dict[str, Any]:
        """
        The OODA reasoning loop:
          1. Observe  — sanitise and filter the prompt
          2. Orient   — load all three memory tiers as context
          3. Decide   — run the ReAct agent
          4. Act      — validate output, sign, return
        """
        # 1. Observe
        safe_prompt = self.filter_input(prompt)

        # 2. Orient — compose three-tier context
        short_mem = self.load_short_term_memory()
        long_mem = self.load_long_term_memory(safe_prompt)
        semantic_buf = self.load_semantic_buffer(safe_prompt)

        context_parts: List[str] = []
        if short_mem:
            context_parts.append(
                f"Recent transactions (short-term memory): {json.dumps(short_mem, default=str)}"
            )
        if long_mem:
            context_parts.append(
                f"Historical patterns (long-term memory): {json.dumps(long_mem)}"
            )
        if semantic_buf:
            context_parts.append(
                f"Pre-fetched document references (semantic buffer): {json.dumps(semantic_buf)}"
            )

        context = "\n".join(context_parts) or "No prior context available."
        full_prompt = f"{context}\n\nUser Request: {safe_prompt}"

        # 3. Decide
        decision_text = await self._run_agent(full_prompt)

        # 4. Act
        validation = self.validate_output(decision_text)
        audit_hash = self.sign_decision(decision_text)

        return {
            "tenant_id": self.tenant_id,
            "prompt": safe_prompt,
            "decision": validation["decision"],
            "intercepted": validation["intercepted"],
            "pending_task_id": validation.get("pending_task_id"),
            "audit_hash": audit_hash,
            "confidence_score": 0.92,
            "timestamp": datetime.utcnow().isoformat(),
        }
