// apps/api-gateway-nest/src/modules/backup/backup.module.ts
import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';

@Module({
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
