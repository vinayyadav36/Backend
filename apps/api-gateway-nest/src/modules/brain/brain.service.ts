// apps/api-gateway-nest/src/modules/brain/brain.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MlBridgeService } from '../../ml-bridge/ml-bridge.service';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';

/**
 * BrainService
 * Proxies requests to the FastAPI Einstein Brain via the HTTP ML Bridge.
 * The CircuitBreakerService protects against cascading failures when the
 * ML Agent is slow or unavailable.
 *
 * gRPC transport: the NestJS ClientGrpc approach is also wired up — see
 * BrainModule.  For most request/response paths the HTTP bridge is simpler;
 * gRPC becomes valuable for StreamThought (server-side streaming).
 */
@Injectable()
export class BrainService {
  private readonly logger = new Logger(BrainService.name);

  constructor(
    private readonly mlBridge: MlBridgeService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  /** Synchronous ReAct reasoning (unary). */
  async reason(prompt: string, tenantId: string, metadata?: Record<string, string>) {
    return this.circuitBreaker.execute(
      'brain-reason',
      () => this.mlBridge.post('/brain/reason', { prompt, metadata }, tenantId),
      () => ({
        decision: '[SAFE MODE] Brain is temporarily unavailable. Please retry shortly.',
        intercepted: false,
        audit_hash: '',
        confidence_score: 0,
        safe_mode: true,
      }),
    );
  }

  /** Async reasoning via Temporal — returns job_id immediately. */
  async reasonAsync(prompt: string, tenantId: string, metadata?: Record<string, string>) {
    return this.circuitBreaker.execute(
      'brain-reason-async',
      () => this.mlBridge.post('/brain/reason/async', { prompt, metadata }, tenantId),
      () => ({ job_id: null, status: 'unavailable', safe_mode: true }),
    );
  }

  /** Route raw data through the Cognitive Router. */
  async routeData(rawData: unknown, metadata: Record<string, unknown>, tenantId: string) {
    return this.mlBridge.post('/data/route', { raw_data: rawData, metadata }, tenantId);
  }

  /** Submit a full Data Ingestion Saga via Temporal. */
  async ingestSaga(rawData: unknown, metadata: Record<string, unknown>, tenantId: string) {
    return this.mlBridge.post('/data/ingest/saga', { raw_data: rawData, metadata }, tenantId);
  }

  /** Retrieve the Einstein Daily Brief for this tenant. */
  async dailyBrief(tenantId: string) {
    return this.circuitBreaker.execute(
      'advisor-brief',
      () => this.mlBridge.post('/advisor/brief', {}, tenantId),
      () => ({ summary: 'Advisor temporarily unavailable.', safe_mode: true }),
    );
  }

  /** Run enforcement cycle against provided metrics. */
  async enforce(metrics: Record<string, unknown>, tenantId: string) {
    return this.mlBridge.post('/ops/enforce', { metrics }, tenantId);
  }

  /** Trigger global failover (Panic Button — HMAC-gated). */
  async triggerCoup(hmacSignature: string, reason: string, tenantId: string) {
    return this.mlBridge.post(
      '/ops/trigger-coup',
      { hmac_signature: hmacSignature, reason },
      tenantId,
    );
  }

  /** Generate and archive the monthly Witness Protection audit report. */
  async witnessReport(
    payload: { capital: number; attacks: number; shredded_gb: number; suggestions_applied: number },
    tenantId: string,
  ) {
    return this.mlBridge.post('/ops/witness-report', payload, tenantId);
  }

  /** Fetch all pending admin suggestions for this tenant. */
  async getSuggestions(tenantId: string) {
    return this.mlBridge.get('/admin/suggestions', tenantId);
  }
}
