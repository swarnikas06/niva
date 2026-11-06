import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedPrincipal } from '@niva/shared-types';
import { ReflectionEngineService } from './reflection-engine.service';
import {
  GetOverviewQueryDto,
  GetObservationsQueryDto,
  CreateLongitudinalObservationRequestDto,
  CorrectObservationRequestDto,
  GenerateReflectionDto,
} from './dto/reflection.dto';

@ApiTags('Reflection & Longitudinal Intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reflection')
export class ReflectionController {
  constructor(private readonly service: ReflectionEngineService) {}

  // ==========================================
  // OVERVIEW
  // ==========================================

  @Get('overview')
  @ApiOperation({
    summary: 'Get longitudinal reflection overview, progress, intentions vs outcomes, and unresolved threads',
  })
  @ApiResponse({ status: 200, description: 'Overview returned' })
  async getOverview(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: GetOverviewQueryDto,
  ) {
    return this.service.getOverview(user.userId, query.windowDays);
  }

  // ==========================================
  // OBSERVATIONS
  // ==========================================

  @Get('observations')
  @ApiOperation({ summary: 'List longitudinal observations with filters' })
  @ApiResponse({ status: 200, description: 'Observations list returned' })
  async getObservations(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: GetObservationsQueryDto,
  ) {
    return this.service.getObservations(user.userId, query);
  }

  @Get('observations/:id')
  @ApiOperation({ summary: 'Get a single longitudinal observation by ID' })
  @ApiResponse({ status: 200, description: 'Observation details returned' })
  @ApiResponse({ status: 404, description: 'Observation not found' })
  async getObservationById(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getObservationById(user.userId, id);
  }

  @Post('observations')
  @ApiOperation({ summary: 'Record a new longitudinal observation' })
  @ApiResponse({ status: 201, description: 'Observation created' })
  async createObservation(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() body: CreateLongitudinalObservationRequestDto,
  ) {
    return this.service.createObservation(user.userId, body);
  }

  @Post('observations/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an observation as accurate and valuable' })
  @ApiResponse({ status: 200, description: 'Observation marked as confirmed' })
  async confirmObservation(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.confirmObservation(user.userId, id);
  }

  @Post('observations/:id/correct')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit user correction notes on an observation' })
  @ApiResponse({ status: 200, description: 'Observation corrected' })
  async correctObservation(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CorrectObservationRequestDto,
  ) {
    return this.service.correctObservation(user.userId, id, body);
  }

  @Post('observations/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss an observation from future grounding' })
  @ApiResponse({ status: 200, description: 'Observation dismissed' })
  async dismissObservation(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.dismissObservation(user.userId, id);
  }

  // ==========================================
  // ANALYSIS & GENERATION
  // ==========================================

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger longitudinal pattern synthesis across recent events and activity' })
  @ApiResponse({ status: 200, description: 'Synthesis complete, overview returned' })
  async generateReflection(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() body: GenerateReflectionDto,
  ) {
    return this.service.generateLongitudinalReflection(
      user.userId,
      body.windowDays,
      body.forceRefresh,
    );
  }
}
