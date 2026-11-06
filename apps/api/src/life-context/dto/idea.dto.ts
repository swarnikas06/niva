import { IsString, IsOptional, IsArray, IsIn, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IdeaStatus, CreateIdeaRequestDto, UpdateIdeaRequestDto, PromoteIdeaRequestDto } from '@niva/shared-types';

export class CreateIdeaDto implements CreateIdeaRequestDto {
  @ApiProperty({ description: 'Idea title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Idea content / notes' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ description: 'Idea topic tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateIdeaDto implements UpdateIdeaRequestDto {
  @ApiPropertyOptional({ description: 'Idea title', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Idea content / notes' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Idea topic tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    enum: ['raw', 'incubating', 'promoted', 'archived'],
    description: 'Idea status',
  })
  @IsOptional()
  @IsIn(['raw', 'incubating', 'promoted', 'archived'])
  status?: IdeaStatus;
}

export class PromoteIdeaDto implements PromoteIdeaRequestDto {
  @ApiPropertyOptional({ description: 'Project title override (defaults to idea title)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Project description override' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Project color tag', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string | null;
}
