// apps/api-gateway-nest/src/common/observability/metrics.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

let sdk: NodeSDK | null = null;

export async function startMetrics(): Promise<void> {
  if (!process.env.OTLP_METRIC_URL) return;

  const metricExporter = new OTLPMetricExporter({ url: process.env.OTLP_METRIC_URL });

  sdk = new NodeSDK({ metricExporter } as any);
  await sdk.start();
  console.log('OpenTelemetry metrics started');
}

export async function shutdownMetrics(): Promise<void> {
  await sdk?.shutdown();
}
