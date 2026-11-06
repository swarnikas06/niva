import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CharactersService } from './characters.service';
import { CharacterRepository } from './character.repository';
import { CharacterArchetype } from '../database/schema';

describe('CharactersService', () => {
  let service: CharactersService;
  let repository: jest.Mocked<CharacterRepository>;

  const mockArchetype: CharacterArchetype = {
    id: 'niva_anchor',
    name: 'The Balanced Anchor',
    tagline: 'Grounded, thoughtful, and context-aware continuity.',
    description: 'Balanced empathy and structured thinking.',
    defaultWarmth: 75,
    defaultDirectness: 65,
    defaultHumor: 50,
    defaultChallengeLevel: 60,
    defaultProactivity: 'medium',
    defaultResponseLength: 'balanced',
    sampleDialogue: [{ user: 'Hi', companion: 'Hello' }],
    isActive: true,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepo = {
      findAllActive: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharactersService,
        { provide: CharacterRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CharactersService>(CharactersService);
    repository = module.get(CharacterRepository);
  });

  it('should return all active character archetypes in sortOrder', async () => {
    repository.findAllActive.mockResolvedValue([mockArchetype]);

    const result = await service.getAllActive();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('niva_anchor');
    expect(result[0].traits.warmth).toBe(75);
    expect(result[0].traits.directness).toBe(65);
    expect(result[0].sampleDialogue).toHaveLength(1);
  });

  it('should return character archetype by ID', async () => {
    repository.findById.mockResolvedValue(mockArchetype);

    const result = await service.getById('niva_anchor');

    expect(result.id).toBe('niva_anchor');
    expect(result.name).toBe('The Balanced Anchor');
  });

  it('should throw NotFoundException if archetype is not found', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.getById('unknown_archetype')).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException if archetype is inactive', async () => {
    repository.findById.mockResolvedValue({
      ...mockArchetype,
      isActive: false,
    });

    await expect(service.getById('niva_anchor')).rejects.toThrow(NotFoundException);
  });
});
