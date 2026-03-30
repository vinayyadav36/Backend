// apps/api-gateway-nest/src/modules/workflows/dto/gst.dto.ts
import { IsString } from 'class-validator';
export class GstDto { @IsString() period: string; }
