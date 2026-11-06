import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedPrincipal } from '@niva/shared-types';
import { ContextAssemblyService } from './context-assembly.service';
import { ContextSnapshotRepository } from './context-snapshot.repository';
import { AssembleContextQueryDto } from './dto/context-assembly.dto';

@ApiTags('Context')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('context')
export class ContextController {
  constructor(
    private readonly assemblyService: ContextAssemblyService,
    private readonly snapshotRepo: ContextSnapshotRepository,
  ) {}

  @Get('current')
  @ApiOperation({ summary: 'Assemble current deterministic Cognitive Context Frame' })
  @SwaggerApiResponse({ status: 200, description: 'Assembled Context Frame returned' })
  async getCurrentContext(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: AssembleContextQueryDto,
  ) {
    return this.assemblyService.assembleContext(user.userId, query);
  }

  @Get('snapshots')
  @ApiOperation({ summary: 'List recent assembled context snapshots for user' })
  @SwaggerApiResponse({ status: 200, description: 'Snapshots list returned' })
  async listSnapshots(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.snapshotRepo.listRecentSnapshots(user.userId);
  }

  @Get('snapshots/:id')
  @ApiOperation({ summary: 'Get specific context snapshot by ID' })
  @SwaggerApiResponse({ status: 200, description: 'Snapshot details returned' })
  async getSnapshotById(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    const snapshot = await this.snapshotRepo.getSnapshotById(user.userId, id);
    if (!snapshot) {
      throw new NotFoundException(`Context snapshot ${id} not found or access denied`);
    }
    return snapshot;
  }
}
