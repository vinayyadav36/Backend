// apps/api-gateway-nest/src/modules/brain/dto/reason.dto.ts
import { IsString, IsOptional, IsObject } from 'class-validator';

export class ReasonDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

export class AsyncReasonDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

export class TriggerCoupDto {
  @IsString()
  hmac_signature: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
