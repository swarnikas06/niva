import { z } from 'zod';

export const PrimaryFocusSchema = z.enum([
  'technical_placement',
  'deep_work',
  'academic_learning',
  'general_growth',
]);

export const ProactivityLevelSchema = z.enum(['low', 'medium', 'high']);

export const ResponseLengthSchema = z.enum(['concise', 'balanced', 'thorough']);

export const OnboardingStepSchema = z.enum([
  'identity',
  'focus',
  'archetype',
  'tone',
  'completed',
  'skipped',
]);

export const TraitScoreSchema = z
  .number()
  .int('Trait value must be an integer')
  .min(1, 'Trait value must be at least 1')
  .max(100, 'Trait value cannot exceed 100');

export const OnboardingUpdateSchema = z.object({
  step: OnboardingStepSchema,
  preferredName: z.string().trim().min(1).max(100).optional(),
  occupationRole: z.string().trim().max(100).optional(),
  primaryFocus: PrimaryFocusSchema.optional(),
  selectedArchetypeId: z.string().trim().min(1).max(50).optional(),
  warmth: TraitScoreSchema.optional(),
  directness: TraitScoreSchema.optional(),
  humor: TraitScoreSchema.optional(),
  challengeLevel: TraitScoreSchema.optional(),
  proactivity: ProactivityLevelSchema.optional(),
  responseLength: ResponseLengthSchema.optional(),
  complete: z.boolean().optional(),
  skip: z.boolean().optional(),
});

export const PersonalizationUpdateSchema = z.object({
  preferredName: z.string().trim().min(1).max(100).optional(),
  occupationRole: z.string().trim().max(100).optional(),
  primaryFocus: PrimaryFocusSchema.optional(),
  selectedArchetypeId: z.string().trim().min(1).max(50).optional(),
  warmth: TraitScoreSchema.optional(),
  directness: TraitScoreSchema.optional(),
  humor: TraitScoreSchema.optional(),
  challengeLevel: TraitScoreSchema.optional(),
  proactivity: ProactivityLevelSchema.optional(),
  responseLength: ResponseLengthSchema.optional(),
});

export type OnboardingUpdateInput = z.infer<typeof OnboardingUpdateSchema>;
export type PersonalizationUpdateInput = z.infer<typeof PersonalizationUpdateSchema>;
