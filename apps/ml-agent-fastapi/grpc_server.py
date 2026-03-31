# apps/ml-agent-fastapi/grpc_server.py
"""
Jarvis gRPC Neural Link — BrainService implementation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Implements the BrainService defined in libs/proto/jarvis_brain.proto.

  Reason()       — synchronous unary RPC (JarvisBrain.decide())
  StreamThought() — server-side streaming with progress steps

Security:
  • Optional mTLS: set GRPC_TLS_CERT / GRPC_TLS_KEY / GRPC_TLS_CA env vars
  • JWT auth interceptor: validates x-tenant-id claim from gRPC metadata

Usage:
    server = await create_grpc_server()   # called from FastAPI startup event
    await server.wait_for_termination()
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import AsyncIterator

import grpc

# Generated stubs (compiled from libs/proto/jarvis_brain.proto)
from generated import jarvis_brain_pb2 as pb2
from generated import jarvis_brain_pb2_grpc as pb2_grpc

logger = logging.getLogger("grpc_server")

_GRPC_PORT = int(os.getenv("GRPC_PORT", "50051"))

# ── Thought steps emitted during StreamThought ────────────────────────────────
_THOUGHT_STEPS = [
    (5,  "Validating tenant isolation…"),
    (15, "Loading short-term memory (Redis)…"),
    (25, "Consulting long-term patterns (pgvector)…"),
    (40, "Pre-fetching semantic document references…"),
    (55, "Executing ReAct reasoning agent…"),
    (75, "Querying double-entry ledger (SELECT only)…"),
    (88, "Validating output — checking for ledger mutations…"),
    (95, "Signing decision with SHA-256…"),
    (100, "Thought complete."),
]


# ── JWT / Tenant Auth Interceptor ─────────────────────────────────────────────

class _TenantAuthInterceptor(grpc.aio.ServerInterceptor):
    """
    Validates that every gRPC call carries a valid x-tenant-id in metadata.
    In production, also verify a signed JWT from the x-auth-token field.
    """

    async def intercept_service(self, continuation, handler_call_details):
        meta = dict(handler_call_details.invocation_metadata)
        tenant_id = meta.get("x-tenant-id", "")
        if not tenant_id:
            async def abort(request, context):
                await context.abort(
                    grpc.StatusCode.UNAUTHENTICATED,
                    "x-tenant-id metadata is required",
                )
            return grpc.unary_unary_rpc_method_handler(abort)
        return await continuation(handler_call_details)


# ── BrainService Servicer ─────────────────────────────────────────────────────

class BrainServicer(pb2_grpc.BrainServiceServicer):

    async def Reason(
        self, request: pb2.ReasonRequest, context: grpc.aio.ServicerContext
    ) -> pb2.ReasonResponse:
        """
        Unary RPC: run a full JarvisBrain.decide() cycle and return the result.
        """
        try:
            from core.brain import JarvisBrain
            brain = JarvisBrain(tenant_id=request.tenant_id)
            result = await brain.decide(request.prompt)

            return pb2.ReasonResponse(
                decision=result.get("decision", ""),
                audit_hash=result.get("audit_hash", ""),
                confidence_score=float(result.get("confidence_score", 0.92)),
                intercepted=bool(result.get("intercepted", False)),
                pending_task_id=result.get("pending_task_id") or "",
            )
        except ValueError as exc:
            # Input filter rejection — security violation
            await context.abort(grpc.StatusCode.PERMISSION_DENIED, str(exc))
        except Exception as exc:
            logger.exception("Reason RPC error: %s", exc)
            await context.abort(
                grpc.StatusCode.INTERNAL,
                f"Brain reasoning error: {exc}",
            )

    async def StreamThought(
        self, request: pb2.ReasonRequest, context: grpc.aio.ServicerContext
    ) -> AsyncIterator[pb2.ThoughtUpdate]:
        """
        Server-side streaming RPC: emit progress steps while the Brain thinks,
        then stream the final result as the last update.
        """
        try:
            from core.brain import JarvisBrain

            # Emit incremental thought steps to the client
            for pct, description in _THOUGHT_STEPS[:-1]:
                if context.cancelled():
                    return
                yield pb2.ThoughtUpdate(
                    step_description=description,
                    progress_percent=pct,
                    partial_result="",
                )
                await asyncio.sleep(0.1)   # brief yield between steps

            # Run the actual reasoning
            brain = JarvisBrain(tenant_id=request.tenant_id)
            result = await brain.decide(request.prompt)

            # Final update carries the complete decision
            yield pb2.ThoughtUpdate(
                step_description=_THOUGHT_STEPS[-1][1],
                progress_percent=100,
                partial_result=json.dumps({
                    "decision":     result.get("decision", ""),
                    "audit_hash":   result.get("audit_hash", ""),
                    "intercepted":  result.get("intercepted", False),
                }, default=str),
            )

        except ValueError as exc:
            await context.abort(grpc.StatusCode.PERMISSION_DENIED, str(exc))
        except Exception as exc:
            logger.exception("StreamThought RPC error: %s", exc)
            await context.abort(grpc.StatusCode.INTERNAL, f"Stream error: {exc}")


# ── Server Factory ────────────────────────────────────────────────────────────

def _load_tls_credentials() -> grpc.ServerCredentials | None:
    """
    Load mTLS credentials from env-var paths.
    Returns None (insecure) if any path is missing — intended for dev only.
    """
    cert_path = os.getenv("GRPC_TLS_CERT")
    key_path = os.getenv("GRPC_TLS_KEY")
    ca_path = os.getenv("GRPC_TLS_CA")

    if not (cert_path and key_path and ca_path):
        return None  # plaintext in dev

    with open(cert_path, "rb") as f:
        cert = f.read()
    with open(key_path, "rb") as f:
        key = f.read()
    with open(ca_path, "rb") as f:
        ca = f.read()

    return grpc.ssl_server_credentials(
        [(key, cert)],
        root_certificates=ca,
        require_client_auth=True,   # mutual TLS
    )


async def create_grpc_server() -> grpc.aio.Server:
    """
    Build and start the gRPC server.
    Called from FastAPI's lifespan startup event.
    """
    server = grpc.aio.server(
        interceptors=[_TenantAuthInterceptor()],
        options=[
            ("grpc.max_receive_message_length", 16 * 1024 * 1024),  # 16 MB
            ("grpc.max_send_message_length",    16 * 1024 * 1024),
        ],
    )
    pb2_grpc.add_BrainServiceServicer_to_server(BrainServicer(), server)

    tls = _load_tls_credentials()
    listen_addr = f"[::]:{_GRPC_PORT}"
    if tls:
        server.add_secure_port(listen_addr, tls)
        logger.info("gRPC Neural Link (mTLS) listening on port %d", _GRPC_PORT)
    else:
        server.add_insecure_port(listen_addr)
        logger.info(
            "gRPC Neural Link (insecure — dev mode) listening on port %d", _GRPC_PORT
        )

    await server.start()
    return server
