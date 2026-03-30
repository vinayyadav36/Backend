// apps/api-gateway-nest/src/modules/super-agent/super-agent.controller.ts
import { Controller, Post, Body, Req } from '@nestjs/common';
import { SuperAgentService } from './super-agent.service';

@Controller('super-agent')
export class SuperAgentController {
  constructor(private readonly superAgentService: SuperAgentService) {}

  /**
   * POST /super-agent/dashboard
   * Runs Finance + Marketing + Sales + Ops brains together.
   * Returns unified executive KPIs and cross-department alerts.
   *
   * Body shape:
   * {
   *   "finance":    { "history": [{ds, y}], "budget": [], "actual": [] },
   *   "marketing":  { "leads": [], "cac_ltv_data": {}, "feedback_texts": [] },
   *   "sales":      { "deals": [], "leads": [] },
   *   "operations": { "inventory": [], "vendors": [], "tickets": [] }
   * }
   */
  @Post('dashboard')
  executiveDashboard(@Body() body: any, @Req() req: any) {
    return this.superAgentService.executiveDashboard(body, req.tenantId);
  }

  /**
   * POST /super-agent/scenario
   * What-if scenario simulation across all departments.
   * Body: { base_payload: {...}, scenarios: ["base","optimistic","pessimistic"] }
   */
  @Post('scenario')
  scenarioSimulation(@Body() body: any, @Req() req: any) {
    return this.superAgentService.scenarioSimulation(
      body.base_payload,
      body.scenarios ?? ['base', 'optimistic', 'pessimistic'],
      req.tenantId,
    );
  }
}
