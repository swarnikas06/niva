import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedPrincipal } from '@niva/shared-types';
import { ProactiveService } from './proactive.service';
import { NotificationIntelligenceService } from './notification-intelligence.service';
import {
  ListProactiveActionsQueryDto,
  UpdateUserProactivePreferencesDto,
} from '../dto/event.dto';

@ApiTags('Proactive Companion')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('proactive')
export class ProactiveController {
  constructor(
    private readonly proactiveService: ProactiveService,
    private readonly notificationIntelligenceService: NotificationIntelligenceService,
  ) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Get user proactive companion preferences' })
  @SwaggerApiResponse({ status: 200, description: 'User proactive preferences' })
  async getPreferences(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.proactiveService.getPreferences(user.userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update user proactive companion preferences' })
  @SwaggerApiResponse({ status: 200, description: 'Updated proactive preferences' })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: UpdateUserProactivePreferencesDto,
  ) {
    return this.proactiveService.updatePreferences(user.userId, dto);
  }

  @Get('actions')
  @ApiOperation({ summary: 'List delivered proactive actions for user' })
  @SwaggerApiResponse({ status: 200, description: 'List of proactive actions' })
  async listActions(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: ListProactiveActionsQueryDto,
  ) {
    return this.proactiveService.listActions(user.userId, query);
  }

  @Post('moments/evaluate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Evaluate contextual companion moments and deliver if warranted' })
  async evaluateMoment(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body('category') category?: string,
  ) {
    return this.notificationIntelligenceService.evaluateAndDeliverMoment(user.userId, category);
  }

  @Post('actions/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss a delivered proactive action' })
  @SwaggerApiResponse({ status: 200, description: 'Dismissed proactive action' })
  async dismissAction(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) actionId: string,
  ) {
    return this.proactiveService.dismissAction(actionId, user.userId);
  }
}
