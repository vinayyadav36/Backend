// apps/api-gateway-nest/src/ml-bridge/ml-bridge.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MlBridgeService } from './ml-bridge.service';

@Module({
  imports: [HttpModule],
  providers: [MlBridgeService],
  exports: [MlBridgeService],
})
export class MlBridgeModule {}
