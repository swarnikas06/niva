import { Injectable } from '@nestjs/common';
import {
  CareerGapAnalysisDto,
  CareerContextFrameDto,
  SkillGapDto,
  SkillStrengthDto,
  NextCareerPriorityDto,
  SkillProficiency,
  SkillImportance,
  StatedReadiness,
  ReadinessDiscrepancy,
} from '@niva/shared-types';
import { CareerRepository } from './career.repository';

const PROFICIENCY_RANK: Record<SkillProficiency | 'none', number> = {
  none: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

const IMPORTANCE_WEIGHT: Record<SkillImportance, number> = {
  mandatory: 3.0,
  high_priority: 2.0,
  nice_to_have: 1.0,
};

@Injectable()
export class CareerIntelligenceService {
  constructor(private readonly careerRepo: CareerRepository) {}

  /**
   * Evaluates real-time career gaps, readiness score, evidence alignment,
   * and next priorities for a user targeting a specific or primary role.
   */
  async evaluateGapAnalysis(
    userId: string,
    targetRoleId?: string,
  ): Promise<CareerGapAnalysisDto> {
    // 1. Resolve Target Role
    let targetRole = targetRoleId
      ? await this.careerRepo.findTargetRoleById(targetRoleId, userId)
      : await this.careerRepo.findPrimaryTargetRole(userId);

    if (!targetRole) {
      const allRoles = await this.careerRepo.listTargetRoles(userId);
      if (allRoles.length > 0) {
        targetRole = allRoles[0] || null;
      }
    }

    if (!targetRole) {
      // Empty analysis when user has not yet specified a target role
      return {
        id: 'no-target-role',
        userId,
        targetRoleId: '',
        targetRoleTitle: 'No target role defined',
        readinessScore: 0,
        statedReadiness: 'exploring',
        evidenceAlignmentScore: 0,
        readinessDiscrepancy: 'unassessed',
        gaps: [],
        strengths: [],
        priorities: [
          {
            rank: 1,
            title: 'Define Primary Target Role',
            action: 'Set your target role (e.g. Distributed Systems Engineer) to begin skill gap mapping.',
            urgency: 'high',
            rationale: 'Career readiness requires a benchmark target role.',
          },
        ],
        computedAt: new Date().toISOString(),
        metadata: null,
      };
    }

    // 2. Fetch User Profile for Stated Readiness
    const profile = await this.careerRepo.findProfileByUserId(userId);
    const statedReadiness: StatedReadiness = (profile?.statedReadiness as StatedReadiness) || 'early_preparation';

    // 3. Fetch Required Skills for the Role
    const requiredSkills = await this.careerRepo.listRoleSkills(targetRole.id);

    // 4. Fetch User's Assessed Skills with Evidence
    const userSkillsList = await this.careerRepo.listUserSkillsWithEvidence(userId);
    const userSkillMap = new Map<string, (typeof userSkillsList)[0]>();
    for (const us of userSkillsList) {
      userSkillMap.set(us.skillId, us);
    }

    // 5. Evaluate Gaps and Strengths
    const gaps: SkillGapDto[] = [];
    const strengths: SkillStrengthDto[] = [];

    let totalWeight = 0;
    let earnedWeight = 0;

    for (const req of requiredSkills) {
      const skillName = req.skill.name;
      const category = req.skill.category as any;
      const importance = req.importance as SkillImportance;
      const minProf = req.minimumProficiency as SkillProficiency;
      const weight = IMPORTANCE_WEIGHT[importance] || 2.0;

      const userSkill = userSkillMap.get(req.skillId);
      const userProf: SkillProficiency | 'none' = userSkill?.selfRating
        ? (userSkill.selfRating as SkillProficiency)
        : 'none';
      const userRank = PROFICIENCY_RANK[userProf];
      const requiredRank = PROFICIENCY_RANK[minProf];

      const evidenceItems = userSkill?.evidence || [];
      const hasEvidence = evidenceItems.length > 0;

      // Weight contribution
      totalWeight += requiredRank * weight;

      // Effective score calculation: discount self-rating if evidence is lacking
      let effectiveRank = Math.min(userRank, requiredRank);
      if (effectiveRank > 0 && !hasEvidence) {
        effectiveRank = Math.max(1, effectiveRank * 0.7); // 30% evidence discount
      }
      earnedWeight += effectiveRank * weight;

      // Gap classification
      if (userProf === 'none' || userRank < requiredRank) {
        let gapSeverity: 'critical' | 'moderate' | 'minor' = 'moderate';
        if (importance === 'mandatory' || userProf === 'none') {
          gapSeverity = 'critical';
        } else if (importance === 'nice_to_have') {
          gapSeverity = 'minor';
        }

        let reason = '';
        if (userProf === 'none') {
          reason = `Required ${importance} skill not yet assessed or acquired.`;
        } else {
          reason = `Current proficiency (${userProf}) is below required level (${minProf}).`;
        }

        gaps.push({
          skillId: req.skillId,
          skillName,
          category,
          importance,
          requiredProficiency: minProf,
          currentProficiency: userProf,
          hasEvidence,
          evidenceCount: evidenceItems.length,
          gapSeverity,
          reason,
        });
      } else if (hasEvidence && userRank >= requiredRank) {
        strengths.push({
          skillId: req.skillId,
          skillName,
          category,
          proficiency: userProf,
          evidenceCount: evidenceItems.length,
          summary: `${userProf.toUpperCase()} proficiency backed by ${evidenceItems.length} evidence artifact(s).`,
        });
      } else if (!hasEvidence && userRank >= requiredRank) {
        // Proficiency claimed but zero evidence
        gaps.push({
          skillId: req.skillId,
          skillName,
          category,
          importance,
          requiredProficiency: minProf,
          currentProficiency: userProf,
          hasEvidence: false,
          evidenceCount: 0,
          gapSeverity: importance === 'mandatory' ? 'critical' : 'moderate',
          reason: `Stated proficiency (${userProf}) meets required level (${minProf}), but lacks verifiable evidence.`,
        });
      }
    }

    // 6. Compute Readiness Score (0-100)
    const readinessScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

    // 7. Compute Evidence Alignment Score (0-100)
    let totalAlignmentPoints = 0;
    let assessedCount = 0;

    for (const us of userSkillsList) {
      assessedCount++;
      const evidenceCount = us.evidence?.length || 0;
      const rank = PROFICIENCY_RANK[us.selfRating as SkillProficiency];

      if (rank >= 3) {
        // Advanced/Expert: requires evidence to align
        totalAlignmentPoints += evidenceCount >= 1 ? 100 : 25;
      } else if (rank === 2) {
        // Intermediate
        totalAlignmentPoints += evidenceCount >= 1 ? 100 : 60;
      } else {
        // Beginner: naturally requires little evidence
        totalAlignmentPoints += 100;
      }
    }

    const evidenceAlignmentScore =
      assessedCount > 0 ? Math.round(totalAlignmentPoints / assessedCount) : 0;

    // 8. Compute Readiness Discrepancy
    let readinessDiscrepancy: ReadinessDiscrepancy = 'aligned';
    if (statedReadiness === 'interview_ready' || statedReadiness === 'moderate_confidence') {
      if (readinessScore < 50 || evidenceAlignmentScore < 45 || gaps.some((g) => g.gapSeverity === 'critical')) {
        readinessDiscrepancy = 'overconfident';
      }
    } else if (statedReadiness === 'exploring' || statedReadiness === 'early_preparation') {
      if (readinessScore >= 75 && evidenceAlignmentScore >= 70 && !gaps.some((g) => g.gapSeverity === 'critical')) {
        readinessDiscrepancy = 'underconfident';
      }
    }

    // 9. Derive Top Actionable Next Priorities
    const priorities: NextCareerPriorityDto[] = [];
    let rank = 1;

    // First: Critical mandatory skill gaps
    const criticalMandatory = gaps.filter((g) => g.importance === 'mandatory');
    for (const gap of criticalMandatory) {
      if (priorities.length >= 4) break;
      priorities.push({
        rank: rank++,
        skillId: gap.skillId,
        skillName: gap.skillName,
        title: `Bridge Mandatory Skill: ${gap.skillName}`,
        action: gap.currentProficiency === 'none'
          ? `Begin foundational study & practical exercises for ${gap.skillName}`
          : `Build a tangible project artifact demonstrating ${gap.requiredProficiency} proficiency in ${gap.skillName}`,
        urgency: 'high',
        rationale: gap.reason,
      });
    }

    // Second: Unevidenced claims in high-priority skills
    const unevidenced = gaps.filter(
      (g) => !g.hasEvidence && g.currentProficiency !== 'none' && !criticalMandatory.includes(g),
    );
    for (const gap of unevidenced) {
      if (priorities.length >= 4) break;
      priorities.push({
        rank: rank++,
        skillId: gap.skillId,
        skillName: gap.skillName,
        title: `Document Evidence for ${gap.skillName}`,
        action: `Publish code, write a design RFC, or log mock interview demonstration for ${gap.skillName}`,
        urgency: 'medium',
        rationale: `Back up your ${gap.currentProficiency} proficiency claim with tangible proof.`,
      });
    }

    // Third: If no gaps or remaining priority slots, add interview prep or practice
    if (priorities.length === 0) {
      priorities.push({
        rank: rank++,
        title: `Conduct Mock Technical Interview for ${targetRole.title}`,
        action: 'Schedule a comprehensive mock session focusing on real-world systems architecture scenarios.',
        urgency: 'medium',
        rationale: 'All benchmark skill requirements are well met and evidenced.',
      });
    }

    // 10. Persist Gap Analysis record
    const saved = await this.careerRepo.saveGapAnalysis({
      userId,
      targetRoleId: targetRole.id,
      readinessScore,
      statedReadiness,
      evidenceAlignmentScore,
      readinessDiscrepancy,
      gaps,
      strengths,
      priorities,
      computedAt: new Date(),
      metadata: {
        totalRequiredSkills: requiredSkills.length,
        assessedSkillsCount: userSkillsList.length,
      },
    });

    return {
      id: saved.id,
      userId,
      targetRoleId: targetRole.id,
      targetRoleTitle: targetRole.title,
      readinessScore,
      statedReadiness,
      evidenceAlignmentScore,
      readinessDiscrepancy,
      gaps,
      strengths,
      priorities,
      computedAt: saved.computedAt.toISOString(),
      metadata: (saved.metadata as Record<string, unknown>) || null,
    };
  }

  /**
   * Assembles concise CareerContextFrameDto for injection into the cognitive ContextFrameDto.
   */
  async assembleCareerContext(userId: string): Promise<CareerContextFrameDto | null> {
    const profile = await this.careerRepo.findProfileByUserId(userId);
    const primaryRole = await this.careerRepo.findPrimaryTargetRole(userId);

    if (!profile && !primaryRole) {
      return null;
    }

    // Get latest or newly evaluated gap analysis
    let analysis = await this.careerRepo.findLatestGapAnalysis(
      userId,
      primaryRole?.id,
    );

    let gapAnalysisDto: CareerGapAnalysisDto;
    if (!analysis) {
      gapAnalysisDto = await this.evaluateGapAnalysis(userId, primaryRole?.id);
    } else {
      gapAnalysisDto = {
        id: analysis.id,
        userId,
        targetRoleId: analysis.targetRoleId,
        readinessScore: analysis.readinessScore,
        statedReadiness: analysis.statedReadiness as StatedReadiness,
        evidenceAlignmentScore: analysis.evidenceAlignmentScore,
        readinessDiscrepancy: analysis.readinessDiscrepancy as ReadinessDiscrepancy,
        gaps: (analysis.gaps as SkillGapDto[]) || [],
        strengths: (analysis.strengths as SkillStrengthDto[]) || [],
        priorities: (analysis.priorities as NextCareerPriorityDto[]) || [],
        computedAt: analysis.computedAt.toISOString(),
        metadata: (analysis.metadata as Record<string, unknown>) || null,
      };
    }

    // Fetch recent preparation activities
    const activities = await this.careerRepo.listPreparationActivities(userId);
    const recentActivities = activities.slice(0, 3).map((a) => ({
      title: a.title,
      activityType: a.activityType as any,
      status: a.status as any,
      completedAt: a.completedAt ? a.completedAt.toISOString() : null,
    }));

    return {
      profile: profile
        ? {
            headline: profile.headline,
            currentLevel: profile.currentLevel as any,
            targetTimelineMonths: profile.targetTimelineMonths,
            targetCompanyTiers: (profile.targetCompanyTiers as string[]) || [],
            status: profile.status as any,
          }
        : undefined,
      primaryTargetRole: primaryRole
        ? {
            id: primaryRole.id,
            title: primaryRole.title,
            roleFamily: primaryRole.roleFamily as any,
            seniorityLevel: primaryRole.seniorityLevel as any,
            priority: primaryRole.priority as any,
          }
        : undefined,
      readinessScore: gapAnalysisDto.readinessScore,
      statedReadiness: gapAnalysisDto.statedReadiness,
      evidenceAlignmentScore: gapAnalysisDto.evidenceAlignmentScore,
      readinessDiscrepancy: gapAnalysisDto.readinessDiscrepancy,
      criticalGaps: gapAnalysisDto.gaps
        .filter((g) => g.gapSeverity === 'critical')
        .slice(0, 3)
        .map((g) => ({
          skillName: g.skillName,
          importance: g.importance,
          requiredProficiency: g.requiredProficiency,
          currentProficiency: g.currentProficiency,
          hasEvidence: g.hasEvidence,
        })),
      keyStrengths: gapAnalysisDto.strengths.slice(0, 3).map((s) => ({
        skillName: s.skillName,
        evidenceCount: s.evidenceCount,
      })),
      recentActivities,
      nextPriorities: gapAnalysisDto.priorities.slice(0, 3).map((p) => p.action),
    };
  }
}
