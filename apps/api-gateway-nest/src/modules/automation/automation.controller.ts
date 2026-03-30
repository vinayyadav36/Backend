// apps/api-gateway-nest/src/modules/automation/automation.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { TemporalClientService } from './temporal.client';

@Controller('automation')
export class AutomationController {
  constructor(private readonly temporalClient: TemporalClientService) {}

  /** POST /automation/reconcile/start — start nightly reconciliation workflow */
  @Post('reconcile/start')
  async startReconcile(@Body() body: { tenantId: string }) {
    const workflowId = await this.temporalClient.startWorkflow(
      'nightlyReconciliationWorkflow',
      [body.tenantId],
    );
    return { workflowId, status: 'started' };
  }

  /** POST /automation/reconcile/approve — manager approves via signal */
  @Post('reconcile/approve')
  async approve(@Body() body: { workflowId: string }) {
    await this.temporalClient.sendSignal(body.workflowId, 'approveReconciliation', true);
    return { status: 'Processing Ledger Write…', workflowId: body.workflowId };
  }

  /** POST /automation/reconcile/reject — manager rejects via signal */
  @Post('reconcile/reject')
  async reject(@Body() body: { workflowId: string }) {
    await this.temporalClient.sendSignal(body.workflowId, 'approveReconciliation', false);
    return { status: 'Reconciliation rejected', workflowId: body.workflowId };
  }
}
