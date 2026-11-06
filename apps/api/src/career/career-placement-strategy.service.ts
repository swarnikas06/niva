import { Injectable } from '@nestjs/common';
import {
  CareerPlacementStrategyDto,
  PlacementStrategyItemDto,
  PlacementPriorityLevel,
  ActivityType,
  MockEvaluationType,
  EvaluationDifficulty,
  CareerGapAnalysisDto,
  RoleFamily,
  SeniorityLevel,
} from '@niva/shared-types';
import { CareerRepository } from './career.repository';
import { CareerIntelligenceService } from './career-intelligence.service';
import { LifeContextRepository } from '../life-context/life-context.repository';

@Injectable()
export class CareerPlacementStrategyService {
  constructor(
    private readonly careerRepo: CareerRepository,
    private readonly careerIntelligence: CareerIntelligenceService,
    private readonly lifeContextRepo: LifeContextRepository,
  ) {}

  /**
   * Synthesizes an evidence-grounded, prioritized career placement strategy.
   * Integrates real-time gap analysis with existing Life Context tasks/projects
   * without duplicating operational entities.
   */
  async getPlacementStrategy(
    userId: string,
    targetRoleId?: string,
  ): Promise<CareerPlacementStrategyDto> {
    // 1. Evaluate or fetch latest real-time Gap Analysis
    const gapAnalysis: CareerGapAnalysisDto =
      await this.careerIntelligence.evaluateGapAnalysis(userId, targetRoleId);

    // 2. Resolve Target Role
    const targetRole = targetRoleId
      ? await this.careerRepo.findTargetRoleById(targetRoleId, userId)
      : await this.careerRepo.findPrimaryTargetRole(userId);

    // 3. Fetch Existing Operational Life Context (authoritative source of truth)
    const [allTasks, activeProjects] = await Promise.all([
      this.lifeContextRepo.findTasks(userId).catch(() => []),
      this.lifeContextRepo.findProjects(userId, { status: 'active' }).catch(() => []),
    ]);
    const pendingTasks = allTasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'cancelled',
    );

    // 4. Map Gaps and Priorities to Actionable Placement Strategy Items
    const priorities: PlacementStrategyItemDto[] = [];

    // Helper to find matching life context tasks
    const findMatchingTasks = (skillName: string) => {
      const words = skillName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4);
      return pendingTasks
        .filter((t) => {
          const tTitle = t.title.toLowerCase();
          const tDesc = (t.description || '').toLowerCase();
          return words.some((w) => tTitle.includes(w) || tDesc.includes(w));
        })
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
        }));
    };

    // Sort gaps: critical mandatory first, then unevidenced, then moderate
    const sortedGaps = [...gapAnalysis.gaps].sort((a, b) => {
      if (a.gapSeverity === 'critical' && b.gapSeverity !== 'critical') return -1;
      if (b.gapSeverity === 'critical' && a.gapSeverity !== 'critical') return 1;
      if (!a.hasEvidence && b.hasEvidence) return -1;
      if (!b.hasEvidence && a.hasEvidence) return 1;
      return 0;
    });

    for (const gap of sortedGaps) {
      if (priorities.length >= 5) break;

      let priorityLevel: PlacementPriorityLevel = 'medium';
      let recommendedActivity: ActivityType = 'coding_challenge';

      if (gap.gapSeverity === 'critical') {
        priorityLevel = 'critical';
        recommendedActivity =
          gap.category === 'systems_architecture'
            ? 'system_design_practice'
            : gap.category === 'leadership_collaboration' || gap.category === 'communication'
              ? 'behavioral_story_prep'
              : 'mock_interview';
      } else if (!gap.hasEvidence) {
        priorityLevel = 'high';
        recommendedActivity =
          gap.category === 'systems_architecture'
            ? 'system_design_practice'
            : 'mock_interview';
      } else if (gap.gapSeverity === 'moderate') {
        priorityLevel = 'high';
        recommendedActivity = 'concept_study';
      } else {
        priorityLevel = 'low';
        recommendedActivity = 'coding_challenge';
      }

      const linkedTasks = findMatchingTasks(gap.skillName);

      priorities.push({
        skillId: gap.skillId,
        skillName: gap.skillName,
        category: gap.category,
        priority: priorityLevel,
        reason: gap.reason,
        action:
          gap.currentProficiency === 'none'
            ? `Acquire core fundamentals and practical implementation patterns in ${gap.skillName}`
            : !gap.hasEvidence
              ? `Demonstrate and validate tangible competency in ${gap.skillName} under evaluation conditions`
              : `Deepen edge-case handling and architectural trade-offs in ${gap.skillName}`,
        recommendedActivity,
        currentProficiency: gap.currentProficiency,
        requiredProficiency: gap.requiredProficiency,
        hasEvidence: gap.hasEvidence,
        linkedLifeTasks: linkedTasks,
      });
    }

    // 5. Derive Current Focus & Strategic Rationale
    let currentFocus = 'Broad technical foundation and role benchmarking.';
    let rationale =
      'Begin by acquiring verified artifacts for mandatory target role requirements.';

    if (gapAnalysis.readinessDiscrepancy === 'overconfident') {
      const topCritical = priorities.find((p) => p.priority === 'critical');
      currentFocus = topCritical
        ? `Closing critical gap in ${topCritical.skillName} before scheduling interview rounds.`
        : 'Aligning stated readiness with verifiable technical artifacts.';
      rationale =
        'Your stated confidence is high, but your verified evidence base is lacking critical proof points. NIVA recommends validating skills in realistic evaluation rounds.';
    } else if (gapAnalysis.readinessDiscrepancy === 'underconfident') {
      currentFocus =
        'Practice comprehensive mock interview loops to build confidence and reinforce verified strengths.';
      rationale =
        'You have solid, evidenced technical competency. Practice communicating your decisions under pressure to translate your strengths into interview performance.';
    } else if (priorities.length > 0) {
      currentFocus = `Targeted preparation on ${priorities[0]?.skillName}.`;
      rationale = priorities[0]?.reason || 'High-leverage preparation focus.';
    }

    // 6. Suggest Focused Mock Session
    let suggestedMockSession: CareerPlacementStrategyDto['suggestedMockSession'] = null;
    if (targetRole && priorities.length > 0) {
      const topPriority = priorities[0]!;
      let evalType: MockEvaluationType = 'technical';
      if (topPriority.category === 'systems_architecture') {
        evalType = 'system_design';
      } else if (
        topPriority.category === 'leadership_collaboration' ||
        topPriority.category === 'communication'
      ) {
        evalType = 'behavioral';
      }

      let difficulty: EvaluationDifficulty = 'intermediate';
      if (topPriority.currentProficiency === 'beginner' || topPriority.currentProficiency === 'none') {
        difficulty = 'foundation';
      } else if (topPriority.currentProficiency === 'advanced' || topPriority.currentProficiency === 'expert') {
        difficulty = 'advanced';
      }

      suggestedMockSession = {
        targetRoleId: targetRole.id,
        skillId: topPriority.skillId,
        skillName: topPriority.skillName,
        evaluationType: evalType,
        suggestedDifficulty: difficulty,
        reason: `Validate your actual depth in ${topPriority.skillName} through a structured 3-question evaluation round.`,
      };
    }

    // 7. Active Life Context Preparation summary
    const activeLifePrep = [
      ...activeProjects.map((p) => ({
        id: p.id,
        title: p.title,
        type: 'project' as const,
        status: p.status,
      })),
      ...pendingTasks.slice(0, 5).map((t) => ({
        id: t.id,
        title: t.title,
        type: 'task' as const,
        status: t.status,
      })),
    ];

    return {
      userId,
      targetRole: targetRole
        ? {
            id: targetRole.id,
            title: targetRole.title,
            roleFamily: targetRole.roleFamily as RoleFamily,
            seniorityLevel: targetRole.seniorityLevel as SeniorityLevel,
          }
        : null,
      currentFocus,
      rationale,
      priorities,
      activeLifeContextPreparation: activeLifePrep,
      suggestedMockSession,
      readinessDiscrepancy: gapAnalysis.readinessDiscrepancy,
      generatedAt: new Date().toISOString(),
    };
  }
}
