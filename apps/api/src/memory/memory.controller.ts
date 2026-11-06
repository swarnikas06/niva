import {
  Controller,
  Get,
  Post,
  Delete,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedPrincipal } from '@niva/shared-types';
import { MemoryService } from './memory.service';
import {
  CreateExtractionJobDto,
  ListMemoryJobsQueryDto,
  ListMemoryCandidatesQueryDto,
  ListMemoriesQueryDto,
  GenerateMemoryEmbeddingDto,
} from './dto/memory.dto';

@ApiTags('Memory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('memory')
export class MemoryController {
  constructor(private readonly service: MemoryService) {}

  // ============================================================================
  // EXTRACTION JOBS
  // ============================================================================

  @Post('jobs')
  @ApiOperation({ summary: 'Enqueues a memory extraction job for a conversation turn' })
  @SwaggerApiResponse({ status: 201, description: 'Extraction job enqueued' })
  async createJob(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateExtractionJobDto,
  ) {
    return this.service.createExtractionJob(user.userId, dto);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List memory extraction jobs for current user' })
  @SwaggerApiResponse({ status: 200, description: 'List of extraction jobs' })
  async getJobs(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: ListMemoryJobsQueryDto,
  ) {
    return this.service.getExtractionJobs(user.userId, query);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get details of a specific memory extraction job' })
  @SwaggerApiResponse({ status: 200, description: 'Extraction job details' })
  async getJobById(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getExtractionJobById(id, user.userId);
  }

  @Post('jobs/:id/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Processes an extraction job via FastAPI AI service' })
  @SwaggerApiResponse({ status: 200, description: 'Job processed and candidates persisted' })
  async processJob(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.processExtractionJob(id, user.userId);
  }

  // ============================================================================
  // MEMORY CANDIDATES
  // ============================================================================

  @Get('candidates')
  @ApiOperation({ summary: 'List extracted memory candidates for current user' })
  @SwaggerApiResponse({ status: 200, description: 'List of memory candidates' })
  async getCandidates(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: ListMemoryCandidatesQueryDto,
  ) {
    return this.service.getCandidates(user.userId, query);
  }

  @Get('candidates/:id')
  @ApiOperation({ summary: 'Get details of a specific memory candidate' })
  @SwaggerApiResponse({ status: 200, description: 'Memory candidate details' })
  async getCandidateById(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getCandidateById(id, user.userId);
  }

  @Post('candidates/:id/evaluate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Evaluates a memory candidate for durability, deduplication, or contradiction' })
  @SwaggerApiResponse({ status: 200, description: 'Evaluation decision and result' })
  async evaluateCandidate(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.evaluateCandidate(id, user.userId);
  }

  // ============================================================================
  // DURABLE MEMORIES RETRIEVAL
  // ============================================================================

  @Get()
  @ApiOperation({ summary: 'List durable memories for current user' })
  @SwaggerApiResponse({ status: 200, description: 'List of durable memories' })
  async getMemories(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: ListMemoriesQueryDto,
  ) {
    return this.service.getMemories(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific durable memory' })
  @SwaggerApiResponse({ status: 200, description: 'Durable memory details' })
  async getMemoryById(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getMemoryById(id, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive/forget a durable memory so it is excluded from future retrieval' })
  @SwaggerApiResponse({ status: 200, description: 'Memory archived/forgotten' })
  async forgetMemory(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.forgetMemory(id, user.userId);
  }

  // ============================================================================
  // EMBEDDING GENERATION
  // ============================================================================

  @Post(':id/embed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generates and persists a dense 768-dim embedding for a durable memory' })
  @SwaggerApiResponse({ status: 200, description: 'Embedding generated and stored' })
  async generateEmbedding(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateMemoryEmbeddingDto,
  ) {
    return this.service.generateAndPersistEmbedding(user.userId, id, dto.text);
  }

  @Get(':id/embed')
  @ApiOperation({ summary: 'Get embedding metadata for a durable memory' })
  @SwaggerApiResponse({ status: 200, description: 'Embedding metadata' })
  async getEmbedding(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getMemoryEmbedding(user.userId, id);
  }
}

