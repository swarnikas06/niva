import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CompanionStateService } from './companion-state.service';
import { CompanionStateRepository } from './companion-state.repository';
import { DRIZZLE_DB } from '../database/database.service';

describe('CompanionStateService', () => {
  let service: CompanionStateService;
  let repository: jest.Mocked<CompanionStateRepository>;
  let mockDb: any;

  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const mockGoalId = '22222222-2222-2222-2222-222222222222';
  const mockProjectId = '33333333-3333-3333-3333-333333333333';

  const baseState = {
    id: 'state-uuid-1',
    userId: mockUserId,
    characterId: 'niva_anchor',
    presenceStatus: 'active' as const,
    interactionMode: 'chat' as const,
    activeFocusGoalId: null,
    activeFocusProjectId: null,
    continuityStreakDays: 1,
    totalInteractions: 0,
    lastInteractionAt: new Date().toISOString(),
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const mockRepo = {
      findByUserId: jest.fn(),
      findOrCreate: jest.fn().mockResolvedValue({ ...baseState }),
      update: jest.fn(),
      incrementInteractions: jest.fn(),
    };

    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanionStateService,
        { provide: CompanionStateRepository, useValue: mockRepo },
        { provide: DRIZZLE_DB, useValue: mockDb },
      ],
    }).compile();

    service = module.get<CompanionStateService>(CompanionStateService);
    repository = module.get(CompanionStateRepository);
  });

  describe('getCompanionState', () => {
    it('returns companion state from repository', async () => {
      mockDb.limit.mockResolvedValueOnce([{ selectedArchetypeId: 'niva_strategist' }]);

      const result = await service.getCompanionState(mockUserId);
      expect(result).toBeDefined();
      expect(result.userId).toBe(mockUserId);
      expect(repository.findOrCreate).toHaveBeenCalledWith(mockUserId, 'niva_strategist');
    });

    it('falls back to niva_anchor if personalization is absent', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.getCompanionState(mockUserId);
      expect(result).toBeDefined();
      expect(repository.findOrCreate).toHaveBeenCalledWith(mockUserId, 'niva_anchor');
    });
  });

  describe('updateCompanionState', () => {
    it('updates presence and interaction mode successfully', async () => {
      mockDb.limit.mockResolvedValueOnce([]); // for getCompanionState
      repository.update.mockResolvedValueOnce({
        ...baseState,
        presenceStatus: 'focused',
        interactionMode: 'study',
      });

      const updated = await service.updateCompanionState(mockUserId, {
        presenceStatus: 'focused',
        interactionMode: 'study',
      });

      expect(updated.presenceStatus).toBe('focused');
      expect(updated.interactionMode).toBe('study');
      expect(repository.update).toHaveBeenCalledWith(mockUserId, {
        presenceStatus: 'focused',
        interactionMode: 'study',
      });
    });

    it('validates activeFocusGoalId ownership and updates focus', async () => {
      mockDb.limit
        .mockResolvedValueOnce([]) // for getCompanionState
        .mockResolvedValueOnce([{ id: mockGoalId }]); // goal ownership query

      repository.update.mockResolvedValueOnce({
        ...baseState,
        activeFocusGoalId: mockGoalId,
      });

      const result = await service.updateCompanionState(mockUserId, {
        activeFocusGoalId: mockGoalId,
      });

      expect(result.activeFocusGoalId).toBe(mockGoalId);
      expect(repository.update).toHaveBeenCalledWith(mockUserId, {
        activeFocusGoalId: mockGoalId,
      });
    });

    it('throws NotFoundException when goal does not belong to user', async () => {
      mockDb.limit
        .mockResolvedValueOnce([]) // for getCompanionState
        .mockResolvedValueOnce([]); // goal not found

      await expect(
        service.updateCompanionState(mockUserId, {
          activeFocusGoalId: mockGoalId,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when project does not belong to user', async () => {
      mockDb.limit
        .mockResolvedValueOnce([]) // for getCompanionState
        .mockResolvedValueOnce([]); // project not found

      await expect(
        service.updateCompanionState(mockUserId, {
          activeFocusProjectId: mockProjectId,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when project goalId does not match selected goal', async () => {
      const otherGoalId = '44444444-4444-4444-4444-444444444444';
      mockDb.limit
        .mockResolvedValueOnce([]) // for getCompanionState
        .mockResolvedValueOnce([{ id: mockGoalId }]) // goal query
        .mockResolvedValueOnce([{ id: mockProjectId, goalId: otherGoalId }]); // project query

      await expect(
        service.updateCompanionState(mockUserId, {
          activeFocusGoalId: mockGoalId,
          activeFocusProjectId: mockProjectId,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
