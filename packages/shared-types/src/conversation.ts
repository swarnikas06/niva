// Canonical Conversation Foundation domain types and DTOs

export type ConversationStatus = 'active' | 'archived';

export type MessageSenderRole = 'user' | 'assistant' | 'system';

export type MessageStatus = 'complete' | 'deleted';

export interface ConversationDto {
  id: string;
  userId: string;
  characterId: string;
  title: string | null;
  status: ConversationStatus;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // Augmented archetype context when available
  character?: {
    id: string;
    name: string;
    tagline: string;
    avatarSymbol: string;
    colorAccent: string;
  };
  lastMessage?: ConversationMessageDto | null;
}

export type Conversation = ConversationDto;

export interface ConversationMessageDto {
  id: string;
  conversationId: string;
  userId: string;
  senderRole: MessageSenderRole;
  content: string;
  sequenceNumber: number;
  status: MessageStatus;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type ConversationMessage = ConversationMessageDto;

export interface ConversationPage {
  items: ConversationDto[];
  total: number;
  hasMore: boolean;
}

export interface MessagePage {
  items: ConversationMessageDto[];
  hasMore: boolean;
  nextCursor?: number | null;
  prevCursor?: number | null;
}

// Request payloads
export interface CreateConversationRequest {
  characterId: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateConversationRequest {
  title?: string;
  status?: ConversationStatus;
  characterId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateMessageRequest {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ListConversationsQuery {
  status?: ConversationStatus;
  limit?: number;
  offset?: number;
}

export interface ListMessagesQuery {
  limit?: number;
  cursor?: number;
  direction?: 'forward' | 'backward';
}
