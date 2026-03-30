// apps/worker-service/src/main.ts
import { Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows/reconciliation.workflow'),
    activities,
    taskQueue: 'jarvis-main',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  console.log('🔧 Jarvis Temporal Worker started on queue: jarvis-main');
  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
