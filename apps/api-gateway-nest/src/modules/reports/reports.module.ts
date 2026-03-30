// apps/api-gateway-nest/src/modules/reports/reports.module.ts
import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { DriveService } from './integrations/drive.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, DriveService],
  exports: [ReportsService],
})
export class ReportsModule {}
