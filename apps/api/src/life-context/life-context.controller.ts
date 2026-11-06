import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedPrincipal } from '@niva/shared-types';
import { LifeContextService } from './life-context.service';
import { CreateGoalDto, UpdateGoalDto } from './dto/goal.dto';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { CreateCommitmentDto, UpdateCommitmentDto } from './dto/commitment.dto';
import { CreateIdeaDto, UpdateIdeaDto, PromoteIdeaDto } from './dto/idea.dto';

@ApiTags('Life Context')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('life')
export class LifeContextController {
  constructor(private readonly service: LifeContextService) {}

  // ==========================================
  // OVERVIEW
  // ==========================================
  @Get('overview')
  @ApiOperation({ summary: 'Get consolidated life context overview' })
  @SwaggerApiResponse({ status: 200, description: 'Life overview returned' })
  async getOverview(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.getOverview(user.userId);
  }

  // ==========================================
  // GOALS
  // ==========================================
  @Get('goals')
  @ApiOperation({ summary: 'List user goals' })
  async getGoals(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.service.getGoals(user.userId, { status, category });
  }

  @Get('goals/:id')
  @ApiOperation({ summary: 'Get single goal by ID' })
  async getGoalById(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.service.getGoalById(id, user.userId);
  }

  @Post('goals')
  @ApiOperation({ summary: 'Create new goal' })
  async createGoal(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateGoalDto,
  ) {
    return this.service.createGoal(user.userId, dto);
  }

  @Patch('goals/:id')
  @ApiOperation({ summary: 'Update existing goal' })
  async updateGoal(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.service.updateGoal(id, user.userId, dto);
  }

  @Delete('goals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete goal' })
  async deleteGoal(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    await this.service.deleteGoal(id, user.userId);
  }

  // ==========================================
  // PROJECTS
  // ==========================================
  @Get('projects')
  @ApiOperation({ summary: 'List user projects' })
  async getProjects(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('goalId') goalId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.getProjects(user.userId, { goalId, status });
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Get single project by ID' })
  async getProjectById(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.service.getProjectById(id, user.userId);
  }

  @Post('projects')
  @ApiOperation({ summary: 'Create new project' })
  async createProject(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateProjectDto,
  ) {
    return this.service.createProject(user.userId, dto);
  }

  @Patch('projects/:id')
  @ApiOperation({ summary: 'Update existing project' })
  async updateProject(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.service.updateProject(id, user.userId, dto);
  }

  @Delete('projects/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete project' })
  async deleteProject(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    await this.service.deleteProject(id, user.userId);
  }

  // ==========================================
  // TASKS
  // ==========================================
  @Get('tasks')
  @ApiOperation({ summary: 'List user tasks' })
  async getTasks(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.service.getTasks(user.userId, { projectId, status, priority });
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Get single task by ID' })
  async getTaskById(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.service.getTaskById(id, user.userId);
  }

  @Post('tasks')
  @ApiOperation({ summary: 'Create new task' })
  async createTask(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateTaskDto,
  ) {
    return this.service.createTask(user.userId, dto);
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Update existing task' })
  async updateTask(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.service.updateTask(id, user.userId, dto);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete task' })
  async deleteTask(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    await this.service.deleteTask(id, user.userId);
  }

  // ==========================================
  // COMMITMENTS
  // ==========================================
  @Get('commitments')
  @ApiOperation({ summary: 'List user commitments' })
  async getCommitments(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getCommitments(user.userId, {
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('commitments/:id')
  @ApiOperation({ summary: 'Get single commitment by ID' })
  async getCommitmentById(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.service.getCommitmentById(id, user.userId);
  }

  @Post('commitments')
  @ApiOperation({ summary: 'Create new commitment' })
  async createCommitment(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateCommitmentDto,
  ) {
    return this.service.createCommitment(user.userId, dto);
  }

  @Patch('commitments/:id')
  @ApiOperation({ summary: 'Update existing commitment' })
  async updateCommitment(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateCommitmentDto,
  ) {
    return this.service.updateCommitment(id, user.userId, dto);
  }

  @Delete('commitments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete commitment' })
  async deleteCommitment(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    await this.service.deleteCommitment(id, user.userId);
  }

  // ==========================================
  // IDEAS
  // ==========================================
  @Get('ideas')
  @ApiOperation({ summary: 'List user ideas' })
  async getIdeas(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('status') status?: string,
  ) {
    return this.service.getIdeas(user.userId, { status });
  }

  @Get('ideas/:id')
  @ApiOperation({ summary: 'Get single idea by ID' })
  async getIdeaById(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.service.getIdeaById(id, user.userId);
  }

  @Post('ideas')
  @ApiOperation({ summary: 'Create new idea' })
  async createIdea(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateIdeaDto,
  ) {
    return this.service.createIdea(user.userId, dto);
  }

  @Patch('ideas/:id')
  @ApiOperation({ summary: 'Update existing idea' })
  async updateIdea(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateIdeaDto,
  ) {
    return this.service.updateIdea(id, user.userId, dto);
  }

  @Delete('ideas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete idea' })
  async deleteIdea(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    await this.service.deleteIdea(id, user.userId);
  }

  @Post('ideas/:id/promote')
  @ApiOperation({ summary: 'Promote idea to project' })
  async promoteIdea(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: PromoteIdeaDto,
  ) {
    return this.service.promoteIdeaToProject(id, user.userId, dto);
  }
}
