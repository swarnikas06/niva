import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedPrincipal } from '@niva/shared-types';
import { CareerService } from './career.service';
import { CareerPlacementStrategyService } from './career-placement-strategy.service';
import { CareerEvaluationService } from './career-evaluation.service';
import {
  CreateCareerProfileRequestDto,
  CreateTargetRoleRequestDto,
  UpdateTargetRoleRequestDto,
  CreateSkillRequestDto,
  LinkRoleSkillRequestDto,
  CreateUserSkillRequestDto,
  CreateSkillEvidenceRequestDto,
  CreatePreparationActivityRequestDto,
  UpdatePreparationActivityRequestDto,
  EvaluateGapAnalysisRequestDto,
  StartMockSessionRequestDto,
  SubmitEvaluationAnswerRequestDto,
} from './dto/career.dto';

@ApiTags('Career & Placement Intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('career')
export class CareerController {
  constructor(
    private readonly service: CareerService,
    private readonly strategyService: CareerPlacementStrategyService,
    private readonly evaluationService: CareerEvaluationService,
  ) {}

  // ==========================================
  // CAREER PROFILE
  // ==========================================
  @Get('profile')
  @ApiOperation({ summary: 'Get authenticated user career profile' })
  @ApiResponse({ status: 200, description: 'Profile returned' })
  async getProfile(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.getProfile(user.userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Create or update career profile' })
  @ApiResponse({ status: 200, description: 'Profile upserted' })
  async upsertProfile(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateCareerProfileRequestDto,
  ) {
    return this.service.upsertProfile(user.userId, dto);
  }

  // ==========================================
  // TARGET ROLES
  // ==========================================
  @Get('target-roles')
  @ApiOperation({ summary: 'List user target roles' })
  async listTargetRoles(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.listTargetRoles(user.userId);
  }

  @Get('target-roles/:id')
  @ApiOperation({ summary: 'Get target role by ID' })
  async getTargetRole(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.service.getTargetRole(id, user.userId);
  }

  @Post('target-roles')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new target role' })
  async createTargetRole(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateTargetRoleRequestDto,
  ) {
    return this.service.createTargetRole(user.userId, dto);
  }

  @Patch('target-roles/:id')
  @ApiOperation({ summary: 'Update an existing target role' })
  async updateTargetRole(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateTargetRoleRequestDto,
  ) {
    return this.service.updateTargetRole(id, user.userId, dto);
  }

  @Delete('target-roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a target role' })
  async deleteTargetRole(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    await this.service.deleteTargetRole(id, user.userId);
  }

  // ==========================================
  // TARGET ROLE SKILL REQUIREMENTS
  // ==========================================
  @Get('target-roles/:id/skills')
  @ApiOperation({ summary: 'List required skills for a target role' })
  async listRoleSkills(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.service.listRoleSkills(id, user.userId);
  }

  @Post('target-roles/:id/skills')
  @ApiOperation({ summary: 'Link or update required skill on a target role' })
  async linkRoleSkill(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: LinkRoleSkillRequestDto,
  ) {
    return this.service.linkRoleSkill(id, user.userId, dto);
  }

  @Delete('target-roles/:id/skills/:skillId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink a required skill from a target role' })
  async unlinkRoleSkill(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Param('skillId') skillId: string,
  ) {
    await this.service.unlinkRoleSkill(id, skillId, user.userId);
  }

  // ==========================================
  // SKILLS CATALOG
  // ==========================================
  @Get('skills')
  @ApiOperation({ summary: 'List or search canonical career skills' })
  async listSkills(@Query('category') category?: string) {
    return this.service.listSkills(category);
  }

  @Post('skills')
  @ApiOperation({ summary: 'Create or resolve a skill in the catalog' })
  async createSkill(@Body() dto: CreateSkillRequestDto) {
    return this.service.createSkill(dto);
  }

  // ==========================================
  // USER SKILLS & EVIDENCE
  // ==========================================
  @Get('user-skills')
  @ApiOperation({ summary: 'List user skills and evidence' })
  async listUserSkills(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.listUserSkills(user.userId);
  }

  @Post('user-skills')
  @ApiOperation({ summary: 'Assess or update a skill for current user' })
  async recordUserSkill(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateUserSkillRequestDto,
  ) {
    return this.service.recordUserSkill(user.userId, dto);
  }

  @Post('user-skills/:id/evidence')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add evidence for an assessed skill' })
  async addSkillEvidence(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: CreateSkillEvidenceRequestDto,
  ) {
    return this.service.addSkillEvidence(id, user.userId, dto);
  }

  // ==========================================
  // PREPARATION ACTIVITIES
  // ==========================================
  @Get('activities')
  @ApiOperation({ summary: 'List preparation activities' })
  async listActivities(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('targetRoleId') targetRoleId?: string,
  ) {
    return this.service.listActivities(user.userId, targetRoleId);
  }

  @Post('activities')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log a preparation activity' })
  async createActivity(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreatePreparationActivityRequestDto,
  ) {
    return this.service.createActivity(user.userId, dto);
  }

  @Patch('activities/:id')
  @ApiOperation({ summary: 'Update or complete a preparation activity' })
  async updateActivity(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdatePreparationActivityRequestDto,
  ) {
    return this.service.updateActivity(id, user.userId, dto);
  }

  // ==========================================
  // GAP ANALYSIS & INTELLIGENCE
  // ==========================================
  @Get('gap-analysis')
  @ApiOperation({ summary: 'Get latest evaluated gap analysis' })
  async getGapAnalysis(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('targetRoleId') targetRoleId?: string,
  ) {
    return this.service.getLatestGapAnalysis(user.userId, targetRoleId);
  }

  @Post('gap-analysis/evaluate')
  @ApiOperation({ summary: 'Run a fresh career gap analysis' })
  async evaluateGapAnalysis(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: EvaluateGapAnalysisRequestDto,
  ) {
    return this.service.evaluateGapAnalysis(user.userId, dto);
  }

  // ==========================================
  // PLACEMENT STRATEGY (PHASE 6B)
  // ==========================================
  @Get('strategy')
  @ApiOperation({ summary: 'Get actionable, evidence-grounded placement strategy' })
  async getStrategy(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('targetRoleId') targetRoleId?: string,
  ) {
    return this.strategyService.getPlacementStrategy(user.userId, targetRoleId);
  }

  // ==========================================
  // MOCK EVALUATIONS & SESSIONS (PHASE 6B)
  // ==========================================
  @Get('evaluations/sessions')
  @ApiOperation({ summary: 'List past and active evaluation sessions' })
  async listEvaluationSessions(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.evaluationService.listSessions(user.userId);
  }

  @Get('evaluations/sessions/active')
  @ApiOperation({ summary: 'Get current active in-progress evaluation session for recovery' })
  async getActiveEvaluationSession(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.evaluationService.getActiveSession(user.userId);
  }

  @Get('evaluations/sessions/:id')
  @ApiOperation({ summary: 'Get evaluation session details with questions and answers' })
  async getEvaluationSession(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.evaluationService.getSession(id, user.userId);
  }

  @Post('evaluations/sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new mock evaluation session' })
  async startEvaluationSession(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: StartMockSessionRequestDto,
  ) {
    return this.evaluationService.startSession(user.userId, dto);
  }

  @Post('evaluations/sessions/:id/answers')
  @ApiOperation({ summary: 'Submit an answer to current question in evaluation session' })
  async submitEvaluationAnswer(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: SubmitEvaluationAnswerRequestDto,
  ) {
    return this.evaluationService.submitAnswer(id, user.userId, dto);
  }

  @Post('evaluations/sessions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel or abandon an in-progress evaluation session' })
  async cancelEvaluationSession(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.evaluationService.cancelSession(id, user.userId);
  }
}

