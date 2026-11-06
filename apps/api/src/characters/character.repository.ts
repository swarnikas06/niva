import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, asc } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.service';
import * as schema from '../database/schema';
import { characterArchetypes, CharacterArchetype } from '../database/schema';

@Injectable()
export class CharacterRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAllActive(): Promise<CharacterArchetype[]> {
    return this.db
      .select()
      .from(characterArchetypes)
      .where(eq(characterArchetypes.isActive, true))
      .orderBy(asc(characterArchetypes.sortOrder))
      .limit(4);
  }

  async findById(id: string): Promise<CharacterArchetype | null> {
    const aliasMap: Record<string, string> = {
      niva_anchor: 'aria',
      niva_strategist: 'atlas',
      niva_guide: 'mira',
      niva_catalyst: 'nova',
    };
    const resolvedId = aliasMap[id] || id;

    const result = await this.db
      .select()
      .from(characterArchetypes)
      .where(eq(characterArchetypes.id, resolvedId))
      .limit(1);

    if (result[0]) return result[0];

    if (resolvedId !== id) {
      const fallback = await this.db
        .select()
        .from(characterArchetypes)
        .where(eq(characterArchetypes.id, id))
        .limit(1);
      return fallback[0] || null;
    }

    return null;
  }
}
