import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PersonalizationService } from './personalization.service';
import { PersonalizationRepository } from './personalization.repository';
import { CharacterRepository } from '../characters/character.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { UserPersonalization, User, CharacterArchetype } from '../database/schema';

describe('PersonalizationService', () => {
  let service: PersonalizationService;
  let personalizationRepo: jest.Mocked<PersonalizationRepository>;
  let characterRepo: jest.Mocked<CharacterRepository>;
  let userRepo: jest.Mocked<UserRepository>;

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: 'hash',
    name: 'Elena Vance',
    avatarUrl: null,
    isEmailVerified: true,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPersonalization: UserPersonalization = {
    id: 'pers-uuid-1',
    userId: 'user-uuid-1',
    preferredName: 'Elena',
    occupationRole: 'Computer Science Student',
    primaryFocus: 'technical_placement',
    selectedArchetypeId: 'niva_anchor',
    warmth: 75,
    directness: 65,
    humor: 50,
    challengeLevel: 60,
    proactivity: 'medium',
    responseLength: 'balanced',
    onboardingCompleted: true,
    onboardingStep: 'completed',
    onboardedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockArchetype: CharacterArchetype = {
    id: 'niva_anchor',
    name: 'The Balanced Anchor',
    tagline: 'Grounded continuity',
    description: 'Balanced empathy',
    defaultWarmth: 75,
    defaultDirectness: 65,
    defaultHumor: 50,
    defaultChallengeLevel: 60,
    defaultProactivity: 'medium',
    defaultResponseLength: 'balanced',
    sampleDialogue: [],
    isActive: true,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPersRepo = {
      findByUserId: jest.fn(),
      upsert: jest.fn(),
    };

    const mockCharRepo = {
      findAllActive: jest.fn(),
      findById: jest.fn(),
    };

    const mockUserRepoMock = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalizationService,
        { provide: PersonalizationRepository, useValue: mockPersRepo },
        { provide: CharacterRepository, useValue: mockCharRepo },
        { provide: UserRepository, useValue: mockUserRepoMock },
      ],
    }).compile();

    service = module.get<PersonalizationService>(PersonalizationService);
    personalizationRepo = module.get(PersonalizationRepository);
    characterRepo = module.get(CharacterRepository);
    userRepo = module.get(UserRepository);
  });

  describe('getPersonalization', () => {
    it('should return existing personalization without mutating database (READ-ONLY)', async () => {
      personalizationRepo.findByUserId.mockResolvedValue(mockPersonalization);

      const result = await service.getPersonalization('user-uuid-1');

      expect(personalizationRepo.findByUserId).toHaveBeenCalledWith('user-uuid-1');
      expect(personalizationRepo.upsert).not.toHaveBeenCalled();
      expect(result.id).toBe('pers-uuid-1');
      expect(result.preferredName).toBe('Elena');
      expect(result.onboardingCompleted).toBe(true);
    });

    it('should return deterministic default state without mutating database when no row exists', async () => {
      personalizationRepo.findByUserId.mockResolvedValue(null);
      userRepo.findById.mockResolvedValue(mockUser);

      const result = await service.getPersonalization('user-uuid-1');

      expect(personalizationRepo.findByUserId).toHaveBeenCalledWith('user-uuid-1');
      expect(personalizationRepo.upsert).not.toHaveBeenCalled();
      expect(result.id).toBeNull();
      expect(result.preferredName).toBe('Elena Vance');
      expect(result.selectedArchetypeId).toBe('niva_anchor');
      expect(result.onboardingCompleted).toBe(false);
      expect(result.onboardingStep).toBe('identity');
    });
  });

  describe('updateOnboarding', () => {
    it('should progressively update onboarding state', async () => {
      characterRepo.findById.mockResolvedValue(mockArchetype);
      personalizationRepo.upsert.mockResolvedValue({
        ...mockPersonalization,
        onboardingCompleted: false,
        onboardingStep: 'focus',
      });

      const result = await service.updateOnboarding('user-uuid-1', {
        step: 'focus',
        preferredName: 'Elena',
        occupationRole: 'Software Engineer',
      });

      expect(personalizationRepo.upsert).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({
          onboardingStep: 'focus',
          preferredName: 'Elena',
          occupationRole: 'Software Engineer',
        }),
      );
      expect(result.onboardingStep).toBe('focus');
    });

    it('should mark onboarding as completed when complete=true', async () => {
      characterRepo.findById.mockResolvedValue(mockArchetype);
      personalizationRepo.upsert.mockResolvedValue(mockPersonalization);

      const result = await service.updateOnboarding('user-uuid-1', {
        step: 'completed',
        complete: true,
      });

      expect(personalizationRepo.upsert).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({
          onboardingCompleted: true,
          onboardingStep: 'completed',
        }),
      );
      expect(result.onboardingCompleted).toBe(true);
    });

    it('should handle skip=true with defaults', async () => {
      personalizationRepo.upsert.mockResolvedValue({
        ...mockPersonalization,
        onboardingCompleted: true,
        onboardingStep: 'skipped',
      });

      const result = await service.updateOnboarding('user-uuid-1', {
        step: 'skipped',
        skip: true,
      });

      expect(personalizationRepo.upsert).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({
          onboardingCompleted: true,
          onboardingStep: 'skipped',
          selectedArchetypeId: 'niva_anchor',
        }),
      );
      expect(result.onboardingStep).toBe('skipped');
    });

    it('should throw BadRequestException if selectedArchetypeId does not exist', async () => {
      characterRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateOnboarding('user-uuid-1', {
          step: 'archetype',
          selectedArchetypeId: 'non_existent_archetype',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(personalizationRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('updatePersonalization', () => {
    it('should update allowed settings fields', async () => {
      characterRepo.findById.mockResolvedValue(mockArchetype);
      personalizationRepo.upsert.mockResolvedValue({
        ...mockPersonalization,
        warmth: 85,
        directness: 75,
      });

      const result = await service.updatePersonalization('user-uuid-1', {
        warmth: 85,
        directness: 75,
      });

      expect(personalizationRepo.upsert).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({
          warmth: 85,
          directness: 75,
        }),
      );
      expect(result.warmth).toBe(85);
    });
  });
});
