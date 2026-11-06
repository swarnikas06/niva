import { Test, TestingModule } from '@nestjs/testing';
import { CareerPlacementStrategyService } from './career-placement-strategy.service';
import { CareerRepository } from './career.repository';
import { CareerIntelligenceService } from './career-intelligence.service';
import { LifeContextRepository } from '../life-context/life-context.repository';
import { CareerGapAnalysisDto } from '@niva/shared-types';

describe('CareerPlacementStrategyService', () => {
  let service: CareerPlacementStrategyService;
  let mockCareerRepo: jest.Mocked<Partial<CareerRepository>>;
  let mockIntelligence: jest.Mocked<Partial<CareerIntelligenceService>>;
  let mockLifeContextRepo: jest.Mocked<Partial<LifeContextRepository>>;

  const userId = '11111111-1111-1111-1111-111111111111';
  const roleId = '22222222-2222-2222-2222-222222222222';
  const skill1Id = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    mockCareerRepo = {
      findTargetRoleById: jest.fn(),
      findPrimaryTargetRole: jest.fn(),
    };

    mockIntelligence = {
      evaluateGapAnalysis: jest.fn(),
    };

    mockLifeContextRepo = {
      findTasks: jest.fn(),
      findProjects: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CareerPlacementStrategyService,
        { provide: CareerRepository, useValue: mockCareerRepo },
        { provide: CareerIntelligenceService, useValue: mockIntelligence },
        { provide: LifeContextRepository, useValue: mockLifeContextRepo },
      ],
    }).compile();

    service = module.get<CareerPlacementStrategyService>(CareerPlacementStrategyService);
  });

  it('generates prioritized strategy integrating Life Context tasks without duplication', async () => {
    mockCareerRepo.findPrimaryTargetRole!.mockResolvedValue({
      id: roleId,
      userId,
      title: 'Senior Systems Engineer',
      roleFamily: 'systems_infrastructure',
      seniorityLevel: 'senior',
      priority: 'primary',
      targetCompanyTypes: [],
      description: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const mockGapAnalysis: CareerGapAnalysisDto = {
      id: 'ga-1',
      userId,
      targetRoleId: roleId,
      targetRoleTitle: 'Senior Systems Engineer',
      readinessScore: 40,
      statedReadiness: 'interview_ready',
      evidenceAlignmentScore: 25,
      readinessDiscrepancy: 'overconfident',
      gaps: [
        {
          skillId: skill1Id,
          skillName: 'Distributed Consensus',
          category: 'systems_architecture',
          importance: 'mandatory',
          requiredProficiency: 'advanced',
          currentProficiency: 'beginner',
          hasEvidence: false,
          evidenceCount: 0,
          gapSeverity: 'critical',
          reason: 'Mandatory skill lacking verified artifacts.',
        },
      ],
      strengths: [],
      priorities: [],
      computedAt: new Date().toISOString(),
      metadata: null,
    };
    mockIntelligence.evaluateGapAnalysis!.mockResolvedValue(mockGapAnalysis);

    mockLifeContextRepo.findTasks!.mockResolvedValue([
      {
        id: 'task-1',
        userId,
        title: 'Study Raft and Paxos distributed consensus papers',
        description: 'Read the extended Raft consensus paper',
        status: 'pending',
        priority: 'high',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);

    mockLifeContextRepo.findProjects!.mockResolvedValue([
      {
        id: 'proj-1',
        userId,
        title: 'VoiceShield AI',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);

    const result = await service.getPlacementStrategy(userId);

    expect(result.userId).toBe(userId);
    expect(result.targetRole?.title).toBe('Senior Systems Engineer');
    expect(result.readinessDiscrepancy).toBe('overconfident');
    expect(result.priorities).toHaveLength(1);

    const p = result.priorities[0]!;
    expect(p.skillName).toBe('Distributed Consensus');
    expect(p.priority).toBe('critical');
    expect(p.recommendedActivity).toBe('system_design_practice');
    // Verifies Life Context integration without duplication
    expect(p.linkedLifeTasks).toHaveLength(1);
    expect(p.linkedLifeTasks[0]!.title).toContain('distributed consensus');

    // Verifies suggested mock session
    expect(result.suggestedMockSession).not.toBeNull();
    expect(result.suggestedMockSession?.skillName).toBe('Distributed Consensus');
    expect(result.suggestedMockSession?.evaluationType).toBe('system_design');
    expect(result.suggestedMockSession?.suggestedDifficulty).toBe('foundation');
  });

  it('handles underconfident discrepancy with encouraging strategy rationale', async () => {
    mockCareerRepo.findPrimaryTargetRole!.mockResolvedValue({
      id: roleId,
      userId,
      title: 'Backend Engineer',
      roleFamily: 'software_engineering',
      seniorityLevel: 'mid',
      priority: 'primary',
      targetCompanyTypes: [],
      description: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    mockIntelligence.evaluateGapAnalysis!.mockResolvedValue({
      id: 'ga-2',
      userId,
      targetRoleId: roleId,
      readinessScore: 85,
      statedReadiness: 'early_preparation',
      evidenceAlignmentScore: 80,
      readinessDiscrepancy: 'underconfident',
      gaps: [],
      strengths: [],
      priorities: [],
      computedAt: new Date().toISOString(),
      metadata: null,
    });

    mockLifeContextRepo.findTasks!.mockResolvedValue([]);
    mockLifeContextRepo.findProjects!.mockResolvedValue([]);

    const result = await service.getPlacementStrategy(userId);

    expect(result.readinessDiscrepancy).toBe('underconfident');
    expect(result.rationale).toContain('evidenced technical competency');
  });
});
