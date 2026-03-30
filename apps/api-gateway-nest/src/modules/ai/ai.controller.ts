// apps/api-gateway-nest/src/modules/ai/ai.controller.ts
import { Controller, Post, Body, Req } from '@nestjs/common';
import { AiService } from './ai.service';
import { ForecastDto } from './dto/forecast.dto';
import { AnomalyDto } from './dto/anomaly.dto';
import { LeadScoreDto } from './dto/lead-score.dto';
import { AgentDto } from './dto/agent.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('embeddings')
  embeddings(@Body('text') text: string, @Req() req: any) {
    return this.aiService.getEmbedding(text, req.tenantId);
  }

  @Post('forecast')
  forecast(@Body() dto: ForecastDto, @Req() req: any) {
    return this.aiService.forecastRevenue(dto, req.tenantId);
  }

  @Post('anomaly')
  anomaly(@Body() dto: AnomalyDto, @Req() req: any) {
    return this.aiService.detectAnomalies(dto, req.tenantId);
  }

  @Post('lead-score')
  leadScore(@Body() dto: LeadScoreDto, @Req() req: any) {
    return this.aiService.scoreLead(dto, req.tenantId);
  }

  @Post('agent')
  agent(@Body() dto: AgentDto, @Req() req: any) {
    return this.aiService.runAgent(dto, req.tenantId);
  }
}
