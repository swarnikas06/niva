import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  @ApiPropertyOptional({
    description: 'Refresh token (optional if provided in HttpOnly cookie)',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
