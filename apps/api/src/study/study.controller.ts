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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedPrincipal } from '@niva/shared-types';
import { StudyIntelligenceService } from './study-intelligence.service';
import {
  CreateStudyTopicRequestDto,
  UpdateStudyTopicRequestDto,
  StartStudySessionRequestDto,
  CompleteStudySessionRequestDto,
  UpdateStudySessionRequestDto,
  CreateLearningDifficultyRequestDto,
  UpdateLearningDifficultyRequestDto,
} from './dto/study.dto';

@ApiTags('Study Intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('study')
export class StudyController {
  constructor(private readonly service: StudyIntelligenceService) {}

  // ==========================================
  // OVERVIEW & RECOMMENDATIONS
  // ==========================================

  @Get('overview')
  @ApiOperation({ summary: 'Get learning progress overview, stats, and active session' })
  @ApiResponse({ status: 200, description: 'Overview summary returned' })
  async getOverview(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.getOverviewSummary(user.userId);
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get deterministic, evidence-grounded next-step study actions' })
  @ApiResponse({ status: 200, description: 'Prioritized recommendations returned' })
  async getRecommendations(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.getRecommendations(user.userId);
  }

  // ==========================================
  // TOPICS
  // ==========================================

  @Get('topics')
  @ApiOperation({ summary: 'List learning topics and subtopics' })
  async listTopics(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('subjectName') subjectName?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listTopics(user.userId, { subjectName, status });
  }

  @Get('topics/:id')
  @ApiOperation({ summary: 'Get topic details with prerequisites' })
  async getTopic(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.service.getTopic(id, user.userId);
  }

  @Post('topics')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new learning topic or subtopic' })
  async createTopic(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateStudyTopicRequestDto,
  ) {
    return this.service.createTopic(user.userId, dto);
  }

  @Patch('topics/:id')
  @ApiOperation({ summary: 'Update learning topic progress, objectives, or target' })
  async updateTopic(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateStudyTopicRequestDto,
  ) {
    return this.service.updateTopic(id, user.userId, dto);
  }

  @Delete('topics/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a learning topic' })
  async deleteTopic(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    await this.service.deleteTopic(id, user.userId);
  }

  // ==========================================
  // STUDY SESSIONS
  // ==========================================

  @Get('sessions')
  @ApiOperation({ summary: 'List past study sessions' })
  async listSessions(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('topicId') topicId?: string,
  ) {
    return this.service.listSessions(user.userId, topicId);
  }

  @Get('sessions/active')
  @ApiOperation({ summary: 'Get currently active in-progress study session for recovery' })
  async getActiveSession(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.getActiveSession(user.userId);
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new study session' })
  async startSession(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: StartStudySessionRequestDto,
  ) {
    return this.service.startSession(user.userId, dto);
  }

  @Post('sessions/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a study session with outcomes and evidence' })
  async completeSession(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: CompleteStudySessionRequestDto,
  ) {
    return this.service.completeSession(id, user.userId, dto);
  }

  @Post('sessions/:id/abandon')
  @ApiOperation({ summary: 'Abandon or cancel an in-progress study session' })
  async abandonSession(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.service.abandonSession(id, user.userId);
  }

  @Post('sessions/:id/cancel')
  @ApiOperation({ summary: 'Cancel an in-progress study session' })
  async cancelSession(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.service.abandonSession(id, user.userId);
  }

  @Patch('sessions/:id')
  @ApiOperation({ summary: 'Update in-progress study session (e.g. scratchpad notes auto-save)' })
  async updateSession(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateStudySessionRequestDto,
  ) {
    return this.service.updateSession(id, user.userId, dto);
  }

  // ==========================================
  // LEARNING DIFFICULTIES
  // ==========================================

  @Get('difficulties')
  @ApiOperation({ summary: 'List recorded learning difficulties' })
  async listDifficulties(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('topicId') topicId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listDifficulties(user.userId, { topicId, status });
  }

  @Post('difficulties')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a specific learning difficulty' })
  async recordDifficulty(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateLearningDifficultyRequestDto,
  ) {
    return this.service.recordDifficulty(user.userId, dto);
  }

  @Patch('difficulties/:id')
  @ApiOperation({ summary: 'Update or resolve a learning difficulty' })
  async updateDifficulty(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateLearningDifficultyRequestDto,
  ) {
    return this.service.updateDifficulty(id, user.userId, dto);
  }

  @Patch('difficulties/:id/resolve')
  @ApiOperation({ summary: 'Resolve a learning difficulty with notes' })
  async resolveDifficulty(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: { resolutionNotes?: string },
  ) {
    return this.service.updateDifficulty(id, user.userId, {
      status: 'resolved',
      resolutionNotes: dto?.resolutionNotes,
    });
  }
}
