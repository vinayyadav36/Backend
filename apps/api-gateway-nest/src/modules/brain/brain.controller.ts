// apps/api-gateway-nest/src/modules/brain/brain.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BrainService } from './brain.service';
import { ReasonDto, AsyncReasonDto, TriggerCoupDto } from './dto/reason.dto';

/**
 * BrainController
 * Exposes all Einstein Brain, Cognitive Router, Advisor, and Consigliere
 * endpoints through the NestJS API Gateway under /api/v1/brain.
 */
@Controller('brain')
export class BrainController {
  constructor(private readonly brainService: BrainService) {}

  // ── Synchronous reasoning ─────────────────────────────────────────────────

  @Post('reason')
  @HttpCode(HttpStatus.OK)
  async reason(@Body() dto: ReasonDto, @Req() req: any) {
    return this.brainService.reason(dto.prompt, req.tenantId, dto.metadata);
  }

  // ── Async reasoning (Temporal — returns job_id) ───────────────────────────

  @Post('reason/async')
  @HttpCode(HttpStatus.ACCEPTED)
  async reasonAsync(@Body() dto: AsyncReasonDto, @Req() req: any) {
    return this.brainService.reasonAsync(dto.prompt, req.tenantId, dto.metadata);
  }

  // ── Cognitive Router ──────────────────────────────────────────────────────

  @Post('data/route')
  @HttpCode(HttpStatus.OK)
  async routeData(@Body() body: { raw_data: unknown; metadata?: Record<string, unknown> }, @Req() req: any) {
    return this.brainService.routeData(body.raw_data, body.metadata ?? {}, req.tenantId);
  }

  @Post('data/ingest/saga')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestSaga(@Body() body: { raw_data: unknown; metadata?: Record<string, unknown> }, @Req() req: any) {
    return this.brainService.ingestSaga(body.raw_data, body.metadata ?? {}, req.tenantId);
  }

  // ── Advisor ───────────────────────────────────────────────────────────────

  @Get('advisor/brief')
  async dailyBrief(@Req() req: any) {
    return this.brainService.dailyBrief(req.tenantId);
  }

  @Get('advisor/suggestions')
  async getSuggestions(@Req() req: any) {
    return this.brainService.getSuggestions(req.tenantId);
  }

  // ── Consigliere ───────────────────────────────────────────────────────────

  @Post('ops/enforce')
  @HttpCode(HttpStatus.OK)
  async enforce(@Body() body: { metrics: Record<string, unknown> }, @Req() req: any) {
    return this.brainService.enforce(body.metrics, req.tenantId);
  }

  @Post('ops/trigger-coup')
  @HttpCode(HttpStatus.OK)
  async triggerCoup(@Body() dto: TriggerCoupDto, @Req() req: any) {
    return this.brainService.triggerCoup(
      dto.hmac_signature,
      dto.reason ?? 'manual_failover',
      req.tenantId,
    );
  }

  // ── Witness Protection ────────────────────────────────────────────────────

  @Post('ops/witness-report')
  @HttpCode(HttpStatus.OK)
  async witnessReport(
    @Body()
    body: {
      capital: number;
      attacks: number;
      shredded_gb: number;
      suggestions_applied?: number;
    },
    @Req() req: any,
  ) {
    return this.brainService.witnessReport(
      {
        capital: body.capital,
        attacks: body.attacks,
        shredded_gb: body.shredded_gb,
        suggestions_applied: body.suggestions_applied ?? 0,
      },
      req.tenantId,
    );
  }
}
