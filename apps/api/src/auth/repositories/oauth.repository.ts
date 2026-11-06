import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.service';
import * as schema from '../../database/schema';
import { oauthAccounts, OAuthAccount, NewOAuthAccount } from '../../database/schema';

@Injectable()
export class OAuthRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByProvider(provider: string, providerUserId: string): Promise<OAuthAccount | null> {
    const result = await this.db
      .select()
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, provider),
          eq(oauthAccounts.providerUserId, providerUserId),
        ),
      )
      .limit(1);
    return result[0] || null;
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    return this.db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, userId));
  }

  async create(data: NewOAuthAccount): Promise<OAuthAccount> {
    const result = await this.db.insert(oauthAccounts).values(data).returning();
    if (!result[0]) {
      throw new Error('Failed to create OAuth account');
    }
    return result[0];
  }
}
