// apps/api-gateway-nest/src/modules/finance/finance.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JournalEntry } from '@libs/accounting';
import { LedgerLine } from '@libs/accounting';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { GstController } from './gst/gst.controller';
import { GstService } from './gst/gst.service';
import { DriveService } from '../reports/integrations/drive.service';

@Module({
  imports: [TypeOrmModule.forFeature([JournalEntry, LedgerLine])],
  controllers: [FinanceController, GstController],
  providers: [FinanceService, GstService, DriveService],
  exports: [FinanceService],
})
export class FinanceModule {}
