// apps/api-gateway-nest/src/common/compliance/compliance.controller.ts
import { Controller, Post, Get, Body, Param, Req } from '@nestjs/common';
import { ComplianceService } from './compliance.service';

@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  /** POST /compliance/consent — record explicit consent */
  @Post('consent')
  recordConsent(
    @Body() body: { userId: string; purpose: string; granted: boolean },
    @Req() req: any,
  ) {
    return this.complianceService.recordConsent(
      body.userId,
      body.purpose,
      body.granted,
      req.tenantId,
    );
  }

  /** GET /compliance/consent/:userId — Right to Access */
  @Get('consent/:userId')
  getConsents(@Param('userId') userId: string) {
    return this.complianceService.getUserConsents(userId);
  }

  /** POST /compliance/consent/revoke — revoke specific consent */
  @Post('consent/revoke')
  revokeConsent(@Body() body: { userId: string; purpose: string }) {
    return this.complianceService.revokeConsent(body.userId, body.purpose);
  }

  /** POST /compliance/erase/:userId — Right to Erasure (GDPR Art. 17) */
  @Post('erase/:userId')
  eraseUser(@Param('userId') userId: string) {
    return this.complianceService.eraseUserData(userId);
  }
}
