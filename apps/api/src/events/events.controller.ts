import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedPrincipal } from '@niva/shared-types';
import { EventProcessorService } from './event-processor.service';
import { ProactiveService } from './proactive/proactive.service';
import { ListEventsQueryDto, ProcessEventsQueryDto } from './dto/event.dto';

@ApiTags('Domain Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(
    private readonly processorService: EventProcessorService,
    private readonly proactiveService: ProactiveService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List domain events audit trail for authenticated user' })
  @SwaggerApiResponse({ status: 200, description: 'Paginated domain events' })
  async listEvents(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: ListEventsQueryDto,
  ) {
    return this.proactiveService.listEvents(user.userId, query);
  }

  @Post('process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger asynchronous domain event processing pass' })
  @SwaggerApiResponse({ status: 200, description: 'Event processing results summary' })
  async processEvents(@Query() query: ProcessEventsQueryDto) {
    const limit = query.limit || 20;
    return this.processorService.processBatch(limit);
  }
}
