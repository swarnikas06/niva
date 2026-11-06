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
import { ConversationService } from './conversation.service';
import {
  CreateConversationDto,
  UpdateConversationDto,
  ListConversationsQueryDto,
} from './dto/conversation.dto';
import { CreateMessageDto, ListMessagesQueryDto } from './dto/message.dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationController {
  constructor(private readonly service: ConversationService) {}

  // ==========================================
  // CONVERSATIONS
  // ==========================================
  @Get()
  @ApiOperation({ summary: 'List user conversations' })
  @SwaggerApiResponse({ status: 200, description: 'Conversations list returned' })
  async getConversations(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.service.getConversations(user.userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create new conversation thread' })
  @SwaggerApiResponse({ status: 201, description: 'Conversation created' })
  async createConversation(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateConversationDto,
  ) {
    return this.service.createConversation(user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single conversation by ID' })
  @SwaggerApiResponse({ status: 200, description: 'Conversation details returned' })
  async getConversationById(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.service.getConversationById(id, user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update conversation metadata or archive status' })
  @SwaggerApiResponse({ status: 200, description: 'Conversation updated' })
  async updateConversation(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.service.updateConversation(id, user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete conversation and its messages' })
  @SwaggerApiResponse({ status: 204, description: 'Conversation deleted' })
  async deleteConversation(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    await this.service.deleteConversation(id, user.userId);
  }

  // ==========================================
  // MESSAGES
  // ==========================================
  @Get(':id/messages')
  @ApiOperation({ summary: 'Get paginated messages for a conversation' })
  @SwaggerApiResponse({ status: 200, description: 'Messages list returned' })
  async getMessages(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.service.getMessages(id, user.userId, query);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a user message and generate context-driven companion response' })
  @SwaggerApiResponse({ status: 201, description: 'User message saved and assistant reply generated' })
  async createMessage(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.service.createMessage(id, user.userId, dto);
  }
}
