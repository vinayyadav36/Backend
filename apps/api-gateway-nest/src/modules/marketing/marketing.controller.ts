// apps/api-gateway-nest/src/modules/marketing/marketing.controller.ts
import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { MarketingService } from './marketing.service';

@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  /** GET /marketing/funnel — funnel drop-off analysis */
  @Post('funnel')
  analyseFunnel(@Body('leads') leads: any[], @Req() req: any) {
    return this.marketingService.analyseFunnel(leads, req.tenantId);
  }

  /** POST /marketing/cac-ltv — Customer Acquisition Cost vs Lifetime Value */
  @Post('cac-ltv')
  calcCacLtv(@Body() body: any, @Req() req: any) {
    return this.marketingService.calcCacLtv(body, req.tenantId);
  }

  /** POST /marketing/forecast — Campaign ROI prediction before launch */
  @Post('forecast')
  forecastCampaignRoi(@Body() campaign: any, @Req() req: any) {
    return this.marketingService.forecastCampaignRoi(campaign, req.tenantId);
  }

  /** POST /marketing/sentiment — NLP sentiment on customer feedback */
  @Post('sentiment')
  analyseSentiment(@Body('texts') texts: string[], @Req() req: any) {
    return this.marketingService.analyseSentiment(texts, req.tenantId);
  }

  /** POST /marketing/segment — K-means audience segmentation */
  @Post('segment')
  segmentAudience(@Body() body: any, @Req() req: any) {
    return this.marketingService.segmentAudience(
      body.customers,
      body.n_clusters ?? 3,
      req.tenantId,
    );
  }

  /** POST /marketing/budget-reallocation — Shift spend to highest-ROI channels */
  @Post('budget-reallocation')
  suggestBudgetReallocation(@Body('channels') channels: any[], @Req() req: any) {
    return this.marketingService.suggestBudgetReallocation(channels, req.tenantId);
  }
}
