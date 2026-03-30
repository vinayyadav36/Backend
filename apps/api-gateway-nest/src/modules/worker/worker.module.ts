// apps/api-gateway-nest/src/modules/worker/worker.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';

@Module({
  imports: [HttpModule],
  controllers: [WorkerController],
  providers: [WorkerService],
})
export class WorkerModule {}
