// apps/api-gateway-nest/src/modules/super-agent/super-agent.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SuperAgentController } from './super-agent.controller';
import { SuperAgentService } from './super-agent.service';

@Module({
  imports: [HttpModule],
  controllers: [SuperAgentController],
  providers: [SuperAgentService],
  exports: [SuperAgentService],
})
export class SuperAgentModule {}
