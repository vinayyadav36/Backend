// apps/api-gateway-nest/src/modules/sales/sales.controller.ts
import { Controller, Post, Body, Req } from '@nestjs/common';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  /** POST /sales/lead-score — XGBoost lead scoring */
  @Post('lead-score')
  scoreLeads(@Body('leads') leads: any[], @Req() req: any) {
    return this.salesService.scoreLeads(leads, req.tenantId);
  }

  /** POST /sales/pipeline — pipeline deal-closure forecast */
  @Post('pipeline')
  forecastPipeline(@Body('deals') deals: any[], @Req() req: any) {
    return this.salesService.forecastPipeline(deals, req.tenantId);
  }

  /** POST /sales/pricing — dynamic pricing suggestions */
  @Post('pricing')
  suggestPricing(@Body('products') products: any[], @Req() req: any) {
    return this.salesService.suggestPricing(products, req.tenantId);
  }

  /** POST /sales/contract — GST-compliant smart contract generation */
  @Post('contract')
  generateContract(@Body() body: any, @Req() req: any) {
    return this.salesService.generateContract(body, req.tenantId);
  }
}
