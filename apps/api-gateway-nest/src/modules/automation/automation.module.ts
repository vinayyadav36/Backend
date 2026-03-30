// apps/api-gateway-nest/src/modules/automation/automation.module.ts
import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { TemporalClientService } from './temporal.client';

@Module({
  controllers: [AutomationController],
  providers: [TemporalClientService],
  exports: [TemporalClientService],
})
export class AutomationModule {}
