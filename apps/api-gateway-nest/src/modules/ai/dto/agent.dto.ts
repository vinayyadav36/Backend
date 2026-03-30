// apps/api-gateway-nest/src/modules/ai/dto/agent.dto.ts
import { IsString, IsObject } from 'class-validator';

export class AgentDto {
  @IsString() task: string;
  @IsObject() payload: Record<string, any>;
}
