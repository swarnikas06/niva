import { Test, TestingModule } from '@nestjs/testing';
import { CareerIntelligenceService } from './career-intelligence.service';
import { CareerRepository } from './career.repository';

describe('CareerIntelligenceService', () => {
  let service: CareerIntelligenceService;
  let mockRepo: jest.Mocked<Partial<CareerRepository>>;

  const userId = '11111111-1111-1111-1111-111111111111';
  const targetRoleId = '22222222-2222-2222-2222-222222222222';
  const skill1Id = '33333333-3333-3333-3333-333333333333';
  const skill2Id = '44444444-4444-4444-4444-444444444444';

  beforeEach(async () => {
    mockRepo = {
      findProfileByUserId: jest.fn(),
      findTargetRoleById: jest.fn(),
      findPrimaryTargetRole: jest.fn(),
      listTargetRoles: jest.fn(),
      listRoleSkills: jest.fn(),
      listUserSkillsWithEvidence: jest.fn(),
      listPreparationActivities: jest.fn(),
      findLatestGapAnalysis: jest.fn(),
      saveGapAnalysis: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CareerIntelligenceService,
        { provide: CareerRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CareerIntelligenceService>(CareerIntelligenceService);
  });

  describe('evaluateGapAnalysis', () => {
    it('returns empty placeholder when no target role exists', async () => {
      mockRepo.findTargetRoleById!.mockResolvedValue(null);
      mockRepo.findPrimaryTargetRole!.mockResolvedValue(null);
      mockRepo.listTargetRoles!.mockResolvedValue([]);

      const result = await service.evaluateGapAnalysis(userId);

      expect(result.targetRoleId).toBe('');
      expect(result.readinessScore).toBe(0);
      expect(result.gaps).toHaveLength(0);
      expect(result.priorities[0].title).toBe('Define Primary Target Role');
    });

    it('identifies critical gaps when mandatory skills are missing', async () => {
      mockRepo.findPrimaryTargetRole!.mockResolvedValue({
        id: targetRoleId,
        userId,
        title: 'Distributed Systems Staff Engineer',
        roleFamily: 'systems_infrastructure',
        seniorityLevel: 'staff',
        priority: 'primary',
        targetCompanyTypes: ['cloud_infrastructure'],
        description: 'Core storage engine lead',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      mockRepo.findProfileByUserId!.mockResolvedValue({
        id: 'p-1',
        userId,
        headline: 'Staff Engineer',
        currentLevel: 'senior',
        targetTimelineMonths: 6,
        targetCompanyTiers: ['tier_1'],
        targetLocations: ['Remote'],
        targetCompensationRange: null,
        statedReadiness: 'early_preparation',
        status: 'active_preparation',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // 2 required skills: 1 mandatory Raft/Paxos (advanced), 1 high-priority Rust (intermediate)
      mockRepo.listRoleSkills!.mockResolvedValue([
        {
          id: 'rs-1',
          targetRoleId,
          skillId: skill1Id,
          importance: 'mandatory',
          minimumProficiency: 'advanced',
          createdAt: new Date(),
          skill: {
            id: skill1Id,
            name: 'Distributed Consensus (Raft/Paxos)',
            category: 'systems_architecture',
            description: 'Consensus protocols',
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: 'rs-2',
          targetRoleId,
          skillId: skill2Id,
          importance: 'high_priority',
          minimumProficiency: 'intermediate',
          createdAt: new Date(),
          skill: {
            id: skill2Id,
            name: 'Rust Concurrency',
            category: 'core_technical',
            description: 'Async Rust & memory safety',
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ] as any);

      // User has only assessed Rust (intermediate) with 1 evidence artifact. Consensus is unassessed.
      mockRepo.listUserSkillsWithEvidence!.mockResolvedValue([
        {
          id: 'us-2',
          userId,
          skillId: skill2Id,
          selfRating: 'intermediate',
          verifiedLevel: 'demonstrated',
          confidenceScore: 70,
          lastPracticedAt: new Date(),
          notes: 'Built multi-threaded queue',
          skill: {
            id: skill2Id,
            name: 'Rust Concurrency',
            category: 'core_technical',
          },
          evidence: [
            {
              id: 'ev-1',
              userSkillId: 'us-2',
              userId,
              evidenceType: 'project_artifact',
              title: 'Async lock-free queue in Rust',
              description: 'Benchmarked with tokio and loom',
              url: 'https://github.com/niva/queue',
              validationStatus: 'demonstrated',
              verifiedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      mockRepo.saveGapAnalysis!.mockImplementation(async (data: any) => ({
        id: 'gap-analysis-1',
        ...data,
      }));

      const result = await service.evaluateGapAnalysis(userId);

      expect(result.targetRoleTitle).toBe('Distributed Systems Staff Engineer');
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0].skillName).toBe('Distributed Consensus (Raft/Paxos)');
      expect(result.gaps[0].gapSeverity).toBe('critical');
      expect(result.gaps[0].importance).toBe('mandatory');

      expect(result.strengths).toHaveLength(1);
      expect(result.strengths[0].skillName).toBe('Rust Concurrency');

      expect(result.priorities[0].title).toContain('Bridge Mandatory Skill: Distributed Consensus');
      expect(result.priorities[0].urgency).toBe('high');
      expect(result.readinessScore).toBeGreaterThan(0);
      expect(result.readinessScore).toBeLessThan(100);
    });

    it('detects overconfidence discrepancy when stated readiness is interview_ready but critical evidence is missing', async () => {
      mockRepo.findPrimaryTargetRole!.mockResolvedValue({
        id: targetRoleId,
        userId,
        title: 'Distributed Systems Staff Engineer',
        roleFamily: 'systems_infrastructure',
        seniorityLevel: 'staff',
        priority: 'primary',
        isActive: true,
      } as any);

      // Stated readiness is interview_ready!
      mockRepo.findProfileByUserId!.mockResolvedValue({
        id: 'p-1',
        userId,
        headline: 'Staff Engineer',
        currentLevel: 'senior',
        statedReadiness: 'interview_ready',
        status: 'active_preparation',
      } as any);

      mockRepo.listRoleSkills!.mockResolvedValue([
        {
          id: 'rs-1',
          targetRoleId,
          skillId: skill1Id,
          importance: 'mandatory',
          minimumProficiency: 'advanced',
          skill: { id: skill1Id, name: 'Distributed Consensus', category: 'systems_architecture' },
        },
      ] as any);

      // User claims "advanced" self-rating, but has ZERO evidence artifacts
      mockRepo.listUserSkillsWithEvidence!.mockResolvedValue([
        {
          id: 'us-1',
          userId,
          skillId: skill1Id,
          selfRating: 'advanced',
          confidenceScore: 90,
          skill: { id: skill1Id, name: 'Distributed Consensus', category: 'systems_architecture' },
          evidence: [], // Zero evidence!
        },
      ] as any);

      mockRepo.saveGapAnalysis!.mockImplementation(async (data: any) => ({
        id: 'gap-analysis-2',
        ...data,
      }));

      const result = await service.evaluateGapAnalysis(userId);

      expect(result.statedReadiness).toBe('interview_ready');
      expect(result.readinessDiscrepancy).toBe('overconfident');
      expect(result.evidenceAlignmentScore).toBeLessThan(50);
      expect(result.gaps[0].reason).toContain('lacks verifiable evidence');
    });
  });

  describe('assembleCareerContext', () => {
    it('returns null when no career profile or target role exists', async () => {
      mockRepo.findProfileByUserId!.mockResolvedValue(null);
      mockRepo.findPrimaryTargetRole!.mockResolvedValue(null);

      const context = await service.assembleCareerContext(userId);
      expect(context).toBeNull();
    });

    it('assembles compact CareerContextFrameDto', async () => {
      mockRepo.findProfileByUserId!.mockResolvedValue({
        id: 'p-1',
        userId,
        headline: 'Staff Storage Engineer',
        currentLevel: 'senior',
        targetTimelineMonths: 6,
        targetCompanyTiers: ['tier_1'],
        status: 'active_preparation',
      } as any);

      mockRepo.findPrimaryTargetRole!.mockResolvedValue({
        id: targetRoleId,
        userId,
        title: 'Distributed Systems Staff Engineer',
        roleFamily: 'systems_infrastructure',
        seniorityLevel: 'staff',
        priority: 'primary',
      } as any);

      mockRepo.findLatestGapAnalysis!.mockResolvedValue({
        id: 'gap-1',
        userId,
        targetRoleId,
        readinessScore: 72,
        statedReadiness: 'moderate_confidence',
        evidenceAlignmentScore: 65,
        readinessDiscrepancy: 'aligned',
        gaps: [
          {
            skillName: 'Raft Compaction',
            importance: 'mandatory',
            requiredProficiency: 'advanced',
            currentProficiency: 'intermediate',
            hasEvidence: false,
            gapSeverity: 'critical',
          },
        ],
        strengths: [
          {
            skillName: 'Rust Concurrency',
            evidenceCount: 2,
          },
        ],
        priorities: [
          {
            rank: 1,
            action: 'Complete Raft log compaction implementation',
          },
        ],
        computedAt: new Date(),
        metadata: null,
      } as any);

      mockRepo.listPreparationActivities!.mockResolvedValue([
        {
          id: 'act-1',
          title: 'Mock Interview on Consensus',
          activityType: 'mock_interview',
          status: 'completed',
          completedAt: new Date(),
        },
      ] as any);

      const context = await service.assembleCareerContext(userId);

      expect(context).not.toBeNull();
      expect(context?.profile?.headline).toBe('Staff Storage Engineer');
      expect(context?.primaryTargetRole?.title).toBe('Distributed Systems Staff Engineer');
      expect(context?.readinessScore).toBe(72);
      expect(context?.readinessDiscrepancy).toBe('aligned');
      expect(context?.criticalGaps).toHaveLength(1);
      expect(context?.keyStrengths).toHaveLength(1);
      expect(context?.recentActivities).toHaveLength(1);
      expect(context?.nextPriorities[0]).toBe('Complete Raft log compaction implementation');
    });
  });
});
