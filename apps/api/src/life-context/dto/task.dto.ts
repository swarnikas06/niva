import { IsString, IsOptional, IsUUID, IsIn, MaxLength, IsNotEmpty, IsInt } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { TaskStatus, PriorityLevel, CreateTaskRequestDto, UpdateTaskRequestDto } from '@niva/shared-types';

export class CreateTaskDto implements CreateTaskRequestDto {
  @ApiPropertyOptional({ description: 'Parent project UUID' })
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @ApiProperty({ description: 'Task title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ description: 'Task detailed description' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: ['urgent', 'high', 'medium', 'low'],
    description: 'Task priority',
    default: 'medium',
  })
  @IsOptional()
  @IsIn(['urgent', 'high', 'medium', 'low'])
  priority?: PriorityLevel;

  @ApiPropertyOptional({ description: 'Due date timestamp' })
  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @ApiPropertyOptional({ description: 'Order index for sorting', default: 0 })
  @IsOptional()
  @IsInt()
  orderIndex?: number;
}

export class UpdateTaskDto implements UpdateTaskRequestDto {
  @ApiPropertyOptional({ description: 'Parent project UUID' })
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @ApiPropertyOptional({ description: 'Task title', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Task detailed description' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: ['todo', 'in_progress', 'completed', 'cancelled'],
    description: 'Task status',
  })
  @IsOptional()
  @IsIn(['todo', 'in_progress', 'completed', 'cancelled'])
  status?: TaskStatus;

  @ApiPropertyOptional({
    enum: ['urgent', 'high', 'medium', 'low'],
    description: 'Task priority',
  })
  @IsOptional()
  @IsIn(['urgent', 'high', 'medium', 'low'])
  priority?: PriorityLevel;

  @ApiPropertyOptional({ description: 'Due date timestamp' })
  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @ApiPropertyOptional({ description: 'Order index for sorting' })
  @IsOptional()
  @IsInt()
  orderIndex?: number;
}
