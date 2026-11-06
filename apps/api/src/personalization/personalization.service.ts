import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  UserPersonalizationDto,
  OnboardingUpdateRequestDto,
  PersonalizationUpdateRequestDto,
  PrimaryFocus,
  ProactivityLevel,
  ResponseLength,
  OnboardingStep,
} from '@niva/shared-types';
import {
  OnboardingUpdateSchema,
  PersonalizationUpdateSchema,
} from '@niva/validation';
import { PersonalizationRepository } from './personalization.repository';
import { CharacterRepository } from '../characters/character.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { UserPersonalization, NewUserPersonalization } from '../database/schema';

@Injectable()
export class PersonalizationService {
  private readonly logger = new Logger(PersonalizationService.name);

  constructor(
    private readonly personalizationRepository: PersonalizationRepository,
    private readonly characterRepository: CharacterRepository,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * READ-ONLY endpoint: Retrieves current user's personalization state.
   * Never mutates the database. If no row exists, returns deterministic default state.
   */
  async getPersonalization(userId: string): Promise<UserPersonalizationDto> {
    const existing = await this.personalizationRepository.findByUserId(userId);
    if (existing) {
      return this.toDto(existing);
    }

    // Deterministic default state (No DB write)
    const user = await this.userRepository.findById(userId);
    return {
      id: null,
      userId,
      preferredName: user?.name || null,
      occupationRole: null,
      primaryFocus: null,
      selectedArchetypeId: 'niva_anchor',
      warmth: 75,
      directness: 65,
      humor: 50,
      challengeLevel: 60,
      proactivity: 'medium',
      responseLength: 'balanced',
      onboardingCompleted: false,
      onboardingStep: 'identity',
      onboardedAt: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  /**
   * Progressively saves or completes the onboarding flow.
   * Performs an atomic upsert into PostgreSQL.
   */
  async updateOnboarding(
    userId: string,
    input: OnboardingUpdateRequestDto,
  ): Promise<UserPersonalizationDto> {
    const validated = OnboardingUpdateSchema.parse(input);

    if (validated.selectedArchetypeId) {
      const archetype = await this.characterRepository.findById(validated.selectedArchetypeId);
      if (!archetype || !archetype.isActive) {
        throw new BadRequestException(
          `Invalid character archetype: '${validated.selectedArchetypeId}'`,
        );
      }
    }

    const updateData: Partial<NewUserPersonalization> = {
      onboardingStep: validated.step,
    };

    if (validated.preferredName !== undefined) updateData.preferredName = validated.preferredName;
    if (validated.occupationRole !== undefined) updateData.occupationRole = validated.occupationRole;
    if (validated.primaryFocus !== undefined) updateData.primaryFocus = validated.primaryFocus;
    if (validated.selectedArchetypeId !== undefined) updateData.selectedArchetypeId = validated.selectedArchetypeId;
    if (validated.warmth !== undefined) updateData.warmth = validated.warmth;
    if (validated.directness !== undefined) updateData.directness = validated.directness;
    if (validated.humor !== undefined) updateData.humor = validated.humor;
    if (validated.challengeLevel !== undefined) updateData.challengeLevel = validated.challengeLevel;
    if (validated.proactivity !== undefined) updateData.proactivity = validated.proactivity;
    if (validated.responseLength !== undefined) updateData.responseLength = validated.responseLength;

    if (validated.skip) {
      updateData.onboardingCompleted = true;
      updateData.onboardingStep = 'skipped';
      updateData.onboardedAt = new Date();
      if (!updateData.selectedArchetypeId) {
        updateData.selectedArchetypeId = 'niva_anchor';
      }
      this.logger.log(`User ${userId} skipped onboarding (defaults applied)`);
    } else if (validated.complete) {
      updateData.onboardingCompleted = true;
      updateData.onboardingStep = 'completed';
      updateData.onboardedAt = new Date();
      this.logger.log(`User ${userId} completed onboarding`);
    }

    const result = await this.personalizationRepository.upsert(userId, updateData);

    // Synchronize preferred name to user.name in users table
    if (validated.preferredName !== undefined && validated.preferredName.trim().length > 0) {
      try {
        await this.userRepository.update(userId, { name: validated.preferredName.trim() });
      } catch (err: any) {
        this.logger.debug(`Could not sync user.name during onboarding: ${err.message}`);
      }
    }

    return this.toDto(result);
  }

  /**
   * Updates allowed personalization fields after onboarding.
   */
  async updatePersonalization(
    userId: string,
    input: PersonalizationUpdateRequestDto,
  ): Promise<UserPersonalizationDto> {
    const validated = PersonalizationUpdateSchema.parse(input);

    if (validated.selectedArchetypeId) {
      const archetype = await this.characterRepository.findById(validated.selectedArchetypeId);
      if (!archetype || !archetype.isActive) {
        throw new BadRequestException(
          `Invalid character archetype: '${validated.selectedArchetypeId}'`,
        );
      }
    }

    const updateData: Partial<NewUserPersonalization> = {};
    if (validated.preferredName !== undefined) updateData.preferredName = validated.preferredName;
    if (validated.occupationRole !== undefined) updateData.occupationRole = validated.occupationRole;
    if (validated.primaryFocus !== undefined) updateData.primaryFocus = validated.primaryFocus;
    if (validated.selectedArchetypeId !== undefined) updateData.selectedArchetypeId = validated.selectedArchetypeId;
    if (validated.warmth !== undefined) updateData.warmth = validated.warmth;
    if (validated.directness !== undefined) updateData.directness = validated.directness;
    if (validated.humor !== undefined) updateData.humor = validated.humor;
    if (validated.challengeLevel !== undefined) updateData.challengeLevel = validated.challengeLevel;
    if (validated.proactivity !== undefined) updateData.proactivity = validated.proactivity;
    if (validated.responseLength !== undefined) updateData.responseLength = validated.responseLength;

    const result = await this.personalizationRepository.upsert(userId, updateData);

    // Synchronize preferred name to user.name in users table
    if (validated.preferredName !== undefined && validated.preferredName.trim().length > 0) {
      try {
        await this.userRepository.update(userId, { name: validated.preferredName.trim() });
      } catch (err: any) {
        this.logger.debug(`Could not sync user.name during personalization update: ${err.message}`);
      }
    }

    this.logger.log(`User ${userId} updated personalization preferences`);
    return this.toDto(result);
  }

  private toDto(row: UserPersonalization): UserPersonalizationDto {
    return {
      id: row.id,
      userId: row.userId,
      preferredName: row.preferredName,
      occupationRole: row.occupationRole,
      primaryFocus: row.primaryFocus as PrimaryFocus | null,
      selectedArchetypeId: row.selectedArchetypeId,
      warmth: row.warmth,
      directness: row.directness,
      humor: row.humor,
      challengeLevel: row.challengeLevel,
      proactivity: row.proactivity as ProactivityLevel,
      responseLength: row.responseLength as ResponseLength,
      onboardingCompleted: row.onboardingCompleted,
      onboardingStep: row.onboardingStep as OnboardingStep,
      onboardedAt: row.onboardedAt ? row.onboardedAt.toISOString() : null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    };
  }
}
