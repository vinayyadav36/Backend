// apps/api-gateway-nest/src/modules/worker/dto/email.dto.ts
import { IsString } from 'class-validator';
export class EmailDto {
  @IsString() to: string;
  @IsString() subject: string;
  @IsString() body: string;
}
