import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.service';
import * as schema from '../../database/schema';
import { users, User, NewUser } from '../../database/schema';

@Injectable()
export class UserRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await this.db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = ${normalizedEmail}`)
      .limit(1);
    return result[0] || null;
  }

  async create(data: NewUser): Promise<User> {
    const normalizedData = {
      ...data,
      email: data.email.trim().toLowerCase(),
    };
    const result = await this.db.insert(users).values(normalizedData).returning();
    if (!result[0]) {
      throw new Error('Failed to create user');
    }
    return result[0];
  }

  async update(id: string, data: Partial<NewUser>): Promise<User> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };
    const result = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    if (!result[0]) {
      throw new Error('User not found to update');
    }
    return result[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }
}
