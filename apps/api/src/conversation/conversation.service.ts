import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConversationRepository, EnrichedConversation } from './conversation.repository';
import {
  CreateConversationDto,
  UpdateConversationDto,
  ListConversationsQueryDto,
} from './dto/conversation.dto';
import { CreateMessageDto, ListMessagesQueryDto } from './dto/message.dto';
import {
  ConversationDto,
  ConversationMessageDto,
  MessagePage,
  ConversationPage,
  ConversationTurnResultDto,
} from '@niva/shared-types';
import { ConversationMessage } from '../database/schema';
import { CompanionOrchestratorService } from '../orchestration/companion-orchestrator.service';

@Injectable()
export class ConversationService {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly companionOrchestrator: CompanionOrchestratorService,
  ) {}

  // ==========================================
  // CONVERSATIONS
  // ==========================================
  async getConversations(
    userId: string,
    query?: ListConversationsQueryDto,
  ): Promise<ConversationPage> {
    const rawConversations = await this.repository.findConversations(userId, {
      status: query?.status,
      limit: query?.limit,
      offset: query?.offset,
    });

    const items = rawConversations.map((c) => this.mapConversationToDto(c));

    return {
      items,
      total: items.length,
      hasMore: items.length === (query?.limit || 50),
    };
  }

  async getConversationById(id: string, userId: string): Promise<ConversationDto> {
    const conv = await this.repository.findConversationById(id, userId);
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }
    return this.mapConversationToDto(conv);
  }

  async createConversation(
    userId: string,
    dto: CreateConversationDto,
  ): Promise<ConversationDto> {
    // 1. Verify character archetype existence
    const archetype = await this.repository.findCharacterArchetype(dto.characterId);
    if (!archetype) {
      throw new BadRequestException(`Character archetype '${dto.characterId}' not found`);
    }

    const title = dto.title?.trim() || 'New Conversation';

    // 2. Persist conversation
    const created = await this.repository.createConversation({
      userId,
      characterId: dto.characterId,
      title,
      status: 'active',
      metadata: dto.metadata || {},
    });

    // 3. Return enriched DTO
    return {
      id: created.id,
      userId: created.userId,
      characterId: created.characterId,
      title: created.title,
      status: created.status as any,
      metadata: created.metadata as any,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      character: {
        id: archetype.id,
        name: archetype.name,
        tagline: archetype.tagline,
        avatarSymbol: archetype.name.charAt(0).toUpperCase(),
        colorAccent: '#6366f1',
      },
      lastMessage: null,
    };
  }

  async updateConversation(
    id: string,
    userId: string,
    dto: UpdateConversationDto,
  ): Promise<ConversationDto> {
    // Verify ownership
    const existing = await this.repository.findConversationById(id, userId);
    if (!existing) {
      throw new NotFoundException('Conversation not found');
    }

    const updated = await this.repository.updateConversation(id, userId, {
      title: dto.title !== undefined ? dto.title.trim() : undefined,
      status: dto.status,
      characterId: dto.characterId,
      metadata: dto.metadata,
    });

    if (!updated) {
      throw new NotFoundException('Conversation not found');
    }

    return this.getConversationById(id, userId);
  }

  async deleteConversation(id: string, userId: string): Promise<void> {
    const deleted = await this.repository.deleteConversation(id, userId);
    if (!deleted) {
      throw new NotFoundException('Conversation not found');
    }
  }

  // ==========================================
  // MESSAGES
  // ==========================================
  async getMessages(
    conversationId: string,
    userId: string,
    query?: ListMessagesQueryDto,
  ): Promise<MessagePage> {
    // Verify conversation ownership
    const conv = await this.repository.findConversationById(conversationId, userId);
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    const limit = query?.limit || 50;
    const rawMessages = await this.repository.findMessages(conversationId, {
      limit,
      cursor: query?.cursor,
      direction: query?.direction,
    });

    const items = rawMessages.map((m) => this.mapMessageToDto(m));

    const nextCursor =
      items.length > 0 ? items[items.length - 1]!.sequenceNumber : null;
    const prevCursor = items.length > 0 ? items[0]!.sequenceNumber : null;

    return {
      items,
      hasMore: items.length === limit,
      nextCursor,
      prevCursor,
    };
  }

  async createMessage(
    conversationId: string,
    userId: string,
    dto: CreateMessageDto,
  ): Promise<ConversationTurnResultDto> {
    return this.companionOrchestrator.orchestrateConversationTurn({
      source: 'conversation',
      userId,
      conversationId,
      message: dto.content,
      metadata: dto.metadata,
    });
  }

  // ==========================================
  // MAPPERS
  // ==========================================
  private mapConversationToDto(c: EnrichedConversation): ConversationDto {
    return {
      id: c.id,
      userId: c.userId,
      characterId: c.characterId,
      title: c.title,
      status: c.status as any,
      metadata: c.metadata as any,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      character: c.character,
      lastMessage: c.lastMessage ? this.mapMessageToDto(c.lastMessage) : null,
    };
  }

  private mapMessageToDto(m: ConversationMessage): ConversationMessageDto {
    return {
      id: m.id,
      conversationId: m.conversationId,
      userId: '', // message is scoped by conversation
      senderRole: m.senderRole as any,
      content: m.content,
      sequenceNumber: m.sequenceNumber,
      status: m.status as any,
      metadata: m.metadata as any,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }
}
