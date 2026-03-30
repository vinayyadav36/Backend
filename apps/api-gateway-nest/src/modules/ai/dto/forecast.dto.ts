// apps/api-gateway-nest/src/modules/ai/dto/forecast.dto.ts
import { IsArray, IsInt, Min } from 'class-validator';

export class ForecastDto {
  @IsArray() history: number[];
  @IsInt() @Min(1) horizon: number;
}
