// apps/api-gateway-nest/src/modules/ai/dto/anomaly.dto.ts
import { IsArray } from 'class-validator';

export class AnomalyDto {
  @IsArray() data: number[];
}
