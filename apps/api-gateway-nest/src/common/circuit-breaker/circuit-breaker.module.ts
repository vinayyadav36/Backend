// apps/api-gateway-nest/src/common/circuit-breaker/circuit-breaker.module.ts
import { Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';

@Module({
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService],
})
export class CircuitBreakerModule {}
