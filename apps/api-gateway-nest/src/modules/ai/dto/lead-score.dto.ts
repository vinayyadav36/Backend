// apps/api-gateway-nest/src/modules/ai/dto/lead-score.dto.ts
import { IsObject } from 'class-validator';

export class LeadScoreDto {
  @IsObject() features: Record<string, any>;
}
