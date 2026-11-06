import { pgTable, varchar, text, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { SampleDialogue } from '@niva/shared-types';

export const characterArchetypes = pgTable('character_archetypes', {
  id: varchar('id', { length: 50 }).primaryKey().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  tagline: varchar('tagline', { length: 255 }).notNull(),
  description: text('description').notNull(),
  detailedPersonality: text('detailed_personality'),
  communicationStyle: text('communication_style'),
  preferredStructure: text('preferred_structure'),
  accentColor: varchar('accent_color', { length: 30 }).default('#2563EB').notNull(),
  avatarId: varchar('avatar_id', { length: 50 }).default('default').notNull(),
  voicePreference: jsonb('voice_preference').$type<Record<string, any>>().default({}).notNull(),
  defaultWarmth: integer('default_warmth').notNull(),
  defaultDirectness: integer('default_directness').notNull(),
  defaultHumor: integer('default_humor').notNull(),
  defaultChallengeLevel: integer('default_challenge_level').notNull(),
  defaultProactivity: varchar('default_proactivity', { length: 20 }).notNull(),
  defaultResponseLength: varchar('default_response_length', { length: 20 }).notNull(),
  sampleDialogue: jsonb('sample_dialogue').$type<SampleDialogue[]>().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CharacterArchetype = typeof characterArchetypes.$inferSelect;
export type NewCharacterArchetype = typeof characterArchetypes.$inferInsert;
