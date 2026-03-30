// apps/api-gateway-nest/src/common/observability/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let sdk: NodeSDK | null = null;

export async function startTracing(): Promise<void> {
  if (!process.env.OTLP_TRACE_URL) return;

  const traceExporter = new OTLPTraceExporter({ url: process.env.OTLP_TRACE_URL });

  sdk = new NodeSDK({
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  await sdk.start();
  console.log('OpenTelemetry tracing started');
}

export async function shutdownTracing(): Promise<void> {
  await sdk?.shutdown();
}
