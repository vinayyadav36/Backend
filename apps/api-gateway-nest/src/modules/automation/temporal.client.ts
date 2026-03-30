// apps/api-gateway-nest/src/modules/automation/temporal.client.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Connection, WorkflowClient } from '@temporalio/client';

@Injectable()
export class TemporalClientService implements OnModuleInit {
  private client: WorkflowClient | null = null;

  async onModuleInit() {
    try {
      const connection = await Connection.connect({
        address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      });
      this.client = new WorkflowClient({ connection });
    } catch {
      console.warn('Temporal server not available — workflow features disabled');
    }
  }

  getClient(): WorkflowClient | null {
    return this.client;
  }

  async startWorkflow(workflowType: string, args: any[], taskQueue = 'jarvis-main'): Promise<string> {
    if (!this.client) throw new Error('Temporal client not connected');
    const handle = await this.client.start(workflowType as any, {
      args,
      taskQueue,
      workflowId: `${workflowType}-${Date.now()}`,
    });
    return handle.workflowId;
  }

  async sendSignal(workflowId: string, signalName: string, payload: any): Promise<void> {
    if (!this.client) throw new Error('Temporal client not connected');
    const handle = this.client.getHandle(workflowId);
    await handle.signal(signalName, payload);
  }
}
