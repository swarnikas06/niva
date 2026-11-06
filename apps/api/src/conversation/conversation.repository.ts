import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, asc, gt, lt, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import {
  Conversation,
  NewConversation,
  ConversationMessage,
} from '../database/schema';

export interface EnrichedConversation extends Conversation {
  character?: {
    id: string;
    name: string;
    tagline: string;
    avatarSymbol: string;
    colorAccent: string;
  };
  lastMessage?: ConversationMessage | null;
}

@Injectable()
export class ConversationRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ==========================================
  // CONVERSATIONS
  // ==========================================
  async findConversations(
    userId: string,
    filter?: { status?: string; limit?: number; offset?: number },
  ): Promise<EnrichedConversation[]> {
    const conditions = [eq(schema.conversations.userId, userId)];

    if (filter?.status) {
      conditions.push(eq(schema.conversations.status, filter.status));
    }

    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;

    const convRows = await this.db
      .select({
        conversation: schema.conversations,
        character: {
          id: schema.characterArchetypes.id,
          name: schema.characterArchetypes.name,
          tagline: schema.characterArchetypes.tagline,
          avatarSymbol: sql<string>`UPPER(SUBSTRING(${schema.characterArchetypes.name}, 1, 1))`,
          colorAccent: sql<string>`'#6366f1'`,
        },
      })
      .from(schema.conversations)
      .leftJoin(
        schema.characterArchetypes,
        eq(schema.conversations.characterId, schema.characterArchetypes.id),
      )
      .where(and(...conditions))
      .orderBy(desc(schema.conversations.updatedAt))
      .limit(limit)
      .offset(offset);

    // Fetch the last message for each conversation
    const result: EnrichedConversation[] = [];
    for (const row of convRows) {
      const lastMsgRows = await this.db
        .select()
        .from(schema.conversationMessages)
        .where(eq(schema.conversationMessages.conversationId, row.conversation.id))
        .orderBy(desc(schema.conversationMessages.sequenceNumber))
        .limit(1);

      result.push({
        ...row.conversation,
        character: row.character?.id ? row.character : undefined,
        lastMessage: lastMsgRows[0] || null,
      });
    }

    return result;
  }

  async findConversationById(
    id: string,
    userId: string,
  ): Promise<EnrichedConversation | null> {
    const rows = await this.db
      .select({
        conversation: schema.conversations,
        character: {
          id: schema.characterArchetypes.id,
          name: schema.characterArchetypes.name,
          tagline: schema.characterArchetypes.tagline,
          avatarSymbol: sql<string>`UPPER(SUBSTRING(${schema.characterArchetypes.name}, 1, 1))`,
          colorAccent: sql<string>`'#6366f1'`,
        },
      })
      .from(schema.conversations)
      .leftJoin(
        schema.characterArchetypes,
        eq(schema.conversations.characterId, schema.characterArchetypes.id),
      )
      .where(
        and(
          eq(schema.conversations.id, id),
          eq(schema.conversations.userId, userId),
        ),
      )
      .limit(1);

    if (!rows[0]) return null;

    const lastMsgRows = await this.db
      .select()
      .from(schema.conversationMessages)
      .where(eq(schema.conversationMessages.conversationId, id))
      .orderBy(desc(schema.conversationMessages.sequenceNumber))
      .limit(1);

    return {
      ...rows[0].conversation,
      character: rows[0].character?.id ? rows[0].character : undefined,
      lastMessage: lastMsgRows[0] || null,
    };
  }

  async createConversation(data: NewConversation): Promise<Conversation> {
    const rows = await this.db
      .insert(schema.conversations)
      .values(data)
      .returning();
    return rows[0]!;
  }

  async updateConversation(
    id: string,
    userId: string,
    data: Partial<NewConversation>,
  ): Promise<Conversation | null> {
    const rows = await this.db
      .update(schema.conversations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.conversations.id, id),
          eq(schema.conversations.userId, userId),
        ),
      )
      .returning();

    return rows[0] || null;
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .delete(schema.conversations)
      .where(
        and(
          eq(schema.conversations.id, id),
          eq(schema.conversations.userId, userId),
        ),
      )
      .returning({ id: schema.conversations.id });

    return rows.length > 0;
  }

  // ==========================================
  // CHARACTER LOOKUP
  // ==========================================
  async findCharacterArchetype(id: string) {
    const rows = await this.db
      .select()
      .from(schema.characterArchetypes)
      .where(eq(schema.characterArchetypes.id, id))
      .limit(1);
    return rows[0] || null;
  }

  // ==========================================
  // MESSAGES
  // ==========================================
  async findMessages(
    conversationId: string,
    filter?: { limit?: number; cursor?: number; direction?: 'forward' | 'backward' },
  ): Promise<ConversationMessage[]> {
    const conditions = [eq(schema.conversationMessages.conversationId, conversationId)];

    const limit = filter?.limit || 50;
    const direction = filter?.direction || 'forward';

    if (filter?.cursor !== undefined) {
      if (direction === 'forward') {
        conditions.push(gt(schema.conversationMessages.sequenceNumber, filter.cursor));
      } else {
        conditions.push(lt(schema.conversationMessages.sequenceNumber, filter.cursor));
      }
    }

    return this.db
      .select()
      .from(schema.conversationMessages)
      .where(and(...conditions))
      .orderBy(asc(schema.conversationMessages.sequenceNumber))
      .limit(limit);
  }

  async createMessage(
    conversationId: string,
    data: {
      senderRole: 'user' | 'assistant' | 'system';
      content: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<ConversationMessage> {
    return this.db.transaction(async (tx) => {
      // 1. Calculate next sequence number for this conversation
      const seqRes = await tx
        .select({
          maxSeq: sql<number>`COALESCE(MAX(${schema.conversationMessages.sequenceNumber}), 0)`,
        })
        .from(schema.conversationMessages)
        .where(eq(schema.conversationMessages.conversationId, conversationId));

      const nextSeq = (Number(seqRes[0]?.maxSeq) || 0) + 1;

      // 2. Insert message
      const rows = await tx
        .insert(schema.conversationMessages)
        .values({
          conversationId,
          senderRole: data.senderRole,
          content: data.content,
          sequenceNumber: nextSeq,
          status: 'complete',
          metadata: data.metadata || {},
        })
        .returning();

      // 3. Touch parent conversation updatedAt
      await tx
        .update(schema.conversations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.conversations.id, conversationId));

      return rows[0]!;
    });
  }
}
