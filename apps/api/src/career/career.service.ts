import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  CareerProfileDto,
  CreateCareerProfileDto,
  UpdateCareerProfileDto,
  CareerTargetRoleDto,
  CreateTargetRoleDto,
  UpdateTargetRoleDto,
  CareerSkillDto,
  CreateSkillDto,
  TargetRoleSkillDto,
  LinkRoleSkillDto,
  UserSkillDto,
  CreateUserSkillDto,
  SkillEvidenceDto,
  CreateSkillEvidenceDto,
  CareerPreparationActivityDto,
  CreatePreparationActivityDto,
  UpdatePreparationActivityDto,
  CareerGapAnalysisDto,
  EvaluateGapAnalysisDto,
} from '@niva/shared-types';
import { CareerRepository } from './career.repository';
import { CareerIntelligenceService } from './career-intelligence.service';
import { EventPublisherService } from '../events/event-publisher.service';

@Injectable()
export class CareerService {

  constructor(
    private readonly repository: CareerRepository,
    private readonly intelligenceService: CareerIntelligenceService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  // ==========================================
  // CAREER PROFILES
  // ==========================================
  async getProfile(userId: string): Promise<CareerProfileDto | null> {
    const p = await this.repository.findProfileByUserId(userId);
    if (!p) return null;
    return this.mapProfileToDto(p);
  }

  async upsertProfile(
    userId: string,
    dto: CreateCareerProfileDto | UpdateCareerProfileDto,
  ): Promise<CareerProfileDto> {
    const existing = await this.repository.findProfileByUserId(userId);
    let profile;

    if (existing) {
      profile = await this.repository.updateProfile(userId, {
        headline: dto.headline ?? existing.headline,
        currentLevel: dto.currentLevel ?? existing.currentLevel,
        targetTimelineMonths: dto.targetTimelineMonths ?? existing.targetTimelineMonths,
        targetCompanyTiers: dto.targetCompanyTiers ?? (existing.targetCompanyTiers as string[]),
        targetLocations: dto.targetLocations ?? (existing.targetLocations as string[]),
        targetCompensationRange:
          dto.targetCompensationRange !== undefined
            ? dto.targetCompensationRange
            : existing.targetCompensationRange,
        statedReadiness: dto.statedReadiness ?? existing.statedReadiness,
        status: dto.status ?? existing.status,
        metadata: dto.metadata ?? (existing.metadata as Record<string, unknown>),
      });
    } else {
      if (!dto.headline || !dto.currentLevel) {
        throw new BadRequestException('Headline and currentLevel are required for initial profile');
      }
      profile = await this.repository.createProfile({
        userId,
        headline: dto.headline,
        currentLevel: dto.currentLevel,
        targetTimelineMonths: dto.targetTimelineMonths ?? 6,
        targetCompanyTiers: dto.targetCompanyTiers ?? [],
        targetLocations: dto.targetLocations ?? [],
        targetCompensationRange: dto.targetCompensationRange ?? null,
        statedReadiness: dto.statedReadiness ?? 'early_preparation',
        status: dto.status ?? 'active_preparation',
        metadata: dto.metadata ?? {},
      });
    }

    if (!profile) {
      throw new BadRequestException('Failed to upsert career profile');
    }

    // Publish domain event
    await this.eventPublisher.publish({
      userId,
      eventType: 'CareerProfileUpdated',
      aggregateType: 'career_profile',
      aggregateId: profile.id,
      payload: {
        headline: profile.headline,
        currentLevel: profile.currentLevel,
        statedReadiness: profile.statedReadiness,
        status: profile.status,
      },
    });

    return this.mapProfileToDto(profile);
  }

  // ==========================================
  // TARGET ROLES
  // ==========================================
  async listTargetRoles(userId: string): Promise<CareerTargetRoleDto[]> {
    const roles = await this.repository.listTargetRoles(userId);
    return roles.map((r) => this.mapTargetRoleToDto(r));
  }

  async getTargetRole(id: string, userId: string): Promise<CareerTargetRoleDto> {
    const role = await this.repository.findTargetRoleById(id, userId);
    if (!role) {
      throw new NotFoundException('Target role not found');
    }
    const skills = await this.repository.listRoleSkills(id);
    return {
      ...this.mapTargetRoleToDto(role),
      requiredSkillsCount: skills.length,
    };
  }

  async createTargetRole(
    userId: string,
    dto: CreateTargetRoleDto,
  ): Promise<CareerTargetRoleDto> {
    const role = await this.repository.createTargetRole({
      userId,
      title: dto.title,
      roleFamily: dto.roleFamily,
      seniorityLevel: dto.seniorityLevel,
      priority: dto.priority ?? 'primary',
      targetCompanyTypes: dto.targetCompanyTypes ?? [],
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });

    await this.eventPublisher.publish({
      userId,
      eventType: 'TargetRoleCreated',
      aggregateType: 'target_role',
      aggregateId: role.id,
      payload: {
        title: role.title,
        roleFamily: role.roleFamily,
        seniorityLevel: role.seniorityLevel,
        priority: role.priority,
      },
    });

    return this.mapTargetRoleToDto(role);
  }

  async updateTargetRole(
    id: string,
    userId: string,
    dto: UpdateTargetRoleDto,
  ): Promise<CareerTargetRoleDto> {
    const role = await this.repository.updateTargetRole(id, userId, dto);
    if (!role) {
      throw new NotFoundException('Target role not found');
    }
    return this.mapTargetRoleToDto(role);
  }

  async deleteTargetRole(id: string, userId: string): Promise<void> {
    const deleted = await this.repository.deleteTargetRole(id, userId);
    if (!deleted) {
      throw new NotFoundException('Target role not found');
    }
  }

  // ==========================================
  // CANONICAL SKILLS
  // ==========================================
  async listSkills(category?: string): Promise<CareerSkillDto[]> {
    const skills = await this.repository.listSkills(category);
    return skills.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category as any,
      description: s.description,
      metadata: s.metadata as Record<string, unknown> | null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async createSkill(dto: CreateSkillDto): Promise<CareerSkillDto> {
    const trimmedName = (dto.name || '').trim();
    if (!trimmedName || trimmedName.length < 2) {
      throw new BadRequestException('Skill name cannot be empty or whitespace only');
    }

    const existing = await this.repository.findSkillByName(trimmedName);
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        category: existing.category as any,
        description: existing.description,
        metadata: existing.metadata as Record<string, unknown> | null,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      };
    }
    const created = await this.repository.createSkill({
      name: trimmedName,
      category: dto.category,
      description: dto.description ?? null,
      metadata: dto.metadata ?? {},
    });
    return {
      id: created.id,
      name: created.name,
      category: created.category as any,
      description: created.description,
      metadata: created.metadata as Record<string, unknown> | null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  // ==========================================
  // TARGET ROLE SKILL LINKING
  // ==========================================
  async listRoleSkills(targetRoleId: string, userId: string): Promise<TargetRoleSkillDto[]> {
    const role = await this.repository.findTargetRoleById(targetRoleId, userId);
    if (!role) {
      throw new NotFoundException('Target role not found');
    }
    const list = await this.repository.listRoleSkills(targetRoleId);
    return list.map((item) => ({
      id: item.id,
      targetRoleId: item.targetRoleId,
      skillId: item.skillId,
      skillName: item.skill.name,
      skillCategory: item.skill.category as any,
      importance: item.importance as any,
      minimumProficiency: item.minimumProficiency as any,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async linkRoleSkill(
    targetRoleId: string,
    userId: string,
    dto: LinkRoleSkillDto,
  ): Promise<TargetRoleSkillDto> {
    const role = await this.repository.findTargetRoleById(targetRoleId, userId);
    if (!role) {
      throw new NotFoundException('Target role not found');
    }
    const skill = await this.repository.findSkillById(dto.skillId);
    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    const linked = await this.repository.linkRoleSkill({
      targetRoleId,
      skillId: dto.skillId,
      importance: dto.importance,
      minimumProficiency: dto.minimumProficiency,
    });

    return {
      id: linked.id,
      targetRoleId: linked.targetRoleId,
      skillId: linked.skillId,
      skillName: skill.name,
      skillCategory: skill.category as any,
      importance: linked.importance as any,
      minimumProficiency: linked.minimumProficiency as any,
      createdAt: linked.createdAt.toISOString(),
    };
  }

  async unlinkRoleSkill(
    targetRoleId: string,
    skillId: string,
    userId: string,
  ): Promise<void> {
    const role = await this.repository.findTargetRoleById(targetRoleId, userId);
    if (!role) {
      throw new NotFoundException('Target role not found');
    }
    const deleted = await this.repository.unlinkRoleSkill(targetRoleId, skillId);
    if (!deleted) {
      throw new NotFoundException('Skill requirement not found on target role');
    }
  }

  // ==========================================
  // USER SKILLS & EVIDENCE
  // ==========================================
  async listUserSkills(userId: string): Promise<UserSkillDto[]> {
    const list = await this.repository.listUserSkillsWithEvidence(userId);
    return list.map((item) => ({
      id: item.id,
      userId: item.userId,
      skillId: item.skillId,
      skillName: item.skill.name,
      skillCategory: item.skill.category as any,
      selfRating: item.selfRating as any,
      verifiedLevel: (item.verifiedLevel as any) || null,
      confidenceScore: item.confidenceScore,
      lastPracticedAt: item.lastPracticedAt ? item.lastPracticedAt.toISOString() : null,
      notes: item.notes,
      evidenceCount: item.evidence.length,
      evidence: item.evidence.map((e) => this.mapEvidenceToDto(e)),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  async recordUserSkill(userId: string, dto: CreateUserSkillDto): Promise<UserSkillDto> {
    const skill = await this.repository.findSkillById(dto.skillId);
    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    const userSkill = await this.repository.createUserSkill({
      userId,
      skillId: dto.skillId,
      selfRating: dto.selfRating,
      confidenceScore: dto.confidenceScore ?? 50,
      lastPracticedAt: dto.lastPracticedAt ? new Date(dto.lastPracticedAt) : null,
      notes: dto.notes ?? null,
    });

    const evidence = await this.repository.listSkillEvidence(userSkill.id, userId);

    return {
      id: userSkill.id,
      userId: userSkill.userId,
      skillId: userSkill.skillId,
      skillName: skill.name,
      skillCategory: skill.category as any,
      selfRating: userSkill.selfRating as any,
      verifiedLevel: (userSkill.verifiedLevel as any) || null,
      confidenceScore: userSkill.confidenceScore,
      lastPracticedAt: userSkill.lastPracticedAt
        ? userSkill.lastPracticedAt.toISOString()
        : null,
      notes: userSkill.notes,
      evidenceCount: evidence.length,
      evidence: evidence.map((e) => this.mapEvidenceToDto(e)),
      createdAt: userSkill.createdAt.toISOString(),
      updatedAt: userSkill.updatedAt.toISOString(),
    };
  }

  async addSkillEvidence(
    userSkillId: string,
    userId: string,
    dto: CreateSkillEvidenceDto,
  ): Promise<SkillEvidenceDto> {
    const userSkill = await this.repository.findUserSkillById(userSkillId, userId);
    if (!userSkill) {
      throw new NotFoundException('User skill assessment not found');
    }

    const ev = await this.repository.addSkillEvidence({
      userSkillId,
      userId,
      evidenceType: dto.evidenceType,
      title: dto.title,
      description: dto.description,
      url: dto.url ?? null,
      validationStatus: dto.validationStatus ?? 'unverified',
      verifiedAt: dto.validationStatus === 'demonstrated' ? new Date() : null,
    });

    await this.eventPublisher.publish({
      userId,
      eventType: 'SkillEvidenceAdded',
      aggregateType: 'career_skill',
      aggregateId: userSkill.skillId,
      payload: {
        userSkillId,
        evidenceId: ev.id,
        evidenceType: ev.evidenceType,
        title: ev.title,
      },
    });

    return this.mapEvidenceToDto(ev);
  }

  // ==========================================
  // PREPARATION ACTIVITIES
  // ==========================================
  async listActivities(
    userId: string,
    targetRoleId?: string,
  ): Promise<CareerPreparationActivityDto[]> {
    const list = await this.repository.listPreparationActivities(userId, targetRoleId);
    return list.map((a) => ({
      id: a.id,
      userId: a.userId,
      targetRoleId: a.targetRoleId,
      skillId: a.skillId,
      skillName: a.skill?.name,
      activityType: a.activityType as any,
      title: a.title,
      status: a.status as any,
      durationMinutes: a.durationMinutes,
      outcomeNotes: a.outcomeNotes,
      performanceScore: a.performanceScore,
      completedAt: a.completedAt ? a.completedAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  }

  async createActivity(
    userId: string,
    dto: CreatePreparationActivityDto,
  ): Promise<CareerPreparationActivityDto> {
    const act = await this.repository.createPreparationActivity({
      userId,
      targetRoleId: dto.targetRoleId ?? null,
      skillId: dto.skillId ?? null,
      activityType: dto.activityType,
      title: dto.title,
      status: dto.status ?? 'planned',
      durationMinutes: dto.durationMinutes ?? null,
      outcomeNotes: dto.outcomeNotes ?? null,
      performanceScore: dto.performanceScore ?? null,
      completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
    });

    return {
      id: act.id,
      userId: act.userId,
      targetRoleId: act.targetRoleId,
      skillId: act.skillId,
      activityType: act.activityType as any,
      title: act.title,
      status: act.status as any,
      durationMinutes: act.durationMinutes,
      outcomeNotes: act.outcomeNotes,
      performanceScore: act.performanceScore,
      completedAt: act.completedAt ? act.completedAt.toISOString() : null,
      createdAt: act.createdAt.toISOString(),
      updatedAt: act.updatedAt.toISOString(),
    };
  }

  async updateActivity(
    id: string,
    userId: string,
    dto: UpdatePreparationActivityDto,
  ): Promise<CareerPreparationActivityDto> {
    const existing = await this.repository.findPreparationActivityById(id, userId);
    if (!existing) {
      throw new NotFoundException('Preparation activity not found');
    }

    const wasCompleted = existing.status === 'completed';
    const isNowCompleted = dto.status === 'completed';

    const act = await this.repository.updatePreparationActivity(id, userId, {
      title: dto.title ?? existing.title,
      status: dto.status ?? existing.status,
      durationMinutes:
        dto.durationMinutes !== undefined ? dto.durationMinutes : existing.durationMinutes,
      outcomeNotes:
        dto.outcomeNotes !== undefined ? dto.outcomeNotes : existing.outcomeNotes,
      performanceScore:
        dto.performanceScore !== undefined ? dto.performanceScore : existing.performanceScore,
      completedAt: isNowCompleted
        ? new Date()
        : dto.completedAt !== undefined
          ? dto.completedAt ? new Date(dto.completedAt) : null
          : existing.completedAt,
    });

    if (!act) {
      throw new NotFoundException('Preparation activity not found');
    }

    if (!wasCompleted && isNowCompleted) {
      await this.eventPublisher.publish({
        userId,
        eventType: 'PreparationActivityCompleted',
        aggregateType: 'preparation_activity',
        aggregateId: act.id,
        payload: {
          title: act.title,
          activityType: act.activityType,
          durationMinutes: act.durationMinutes,
          performanceScore: act.performanceScore,
        },
      });
    }

    return {
      id: act.id,
      userId: act.userId,
      targetRoleId: act.targetRoleId,
      skillId: act.skillId,
      activityType: act.activityType as any,
      title: act.title,
      status: act.status as any,
      durationMinutes: act.durationMinutes,
      outcomeNotes: act.outcomeNotes,
      performanceScore: act.performanceScore,
      completedAt: act.completedAt ? act.completedAt.toISOString() : null,
      createdAt: act.createdAt.toISOString(),
      updatedAt: act.updatedAt.toISOString(),
    };
  }

  // ==========================================
  // GAP ANALYSIS & INTELLIGENCE
  // ==========================================
  async getLatestGapAnalysis(
    userId: string,
    targetRoleId?: string,
  ): Promise<CareerGapAnalysisDto> {
    const analysis = await this.repository.findLatestGapAnalysis(userId, targetRoleId);
    if (!analysis) {
      return this.intelligenceService.evaluateGapAnalysis(userId, targetRoleId);
    }

    let targetRoleTitle: string | undefined;
    if (analysis.targetRoleId) {
      const role = await this.repository.findTargetRoleById(analysis.targetRoleId, userId);
      targetRoleTitle = role?.title;
    }

    return {
      id: analysis.id,
      userId: analysis.userId,
      targetRoleId: analysis.targetRoleId,
      targetRoleTitle,
      readinessScore: analysis.readinessScore,
      statedReadiness: analysis.statedReadiness as any,
      evidenceAlignmentScore: analysis.evidenceAlignmentScore,
      readinessDiscrepancy: analysis.readinessDiscrepancy as any,
      gaps: (analysis.gaps as any[]) || [],
      strengths: (analysis.strengths as any[]) || [],
      priorities: (analysis.priorities as any[]) || [],
      computedAt: analysis.computedAt.toISOString(),
      metadata: (analysis.metadata as Record<string, unknown>) || null,
    };
  }

  async evaluateGapAnalysis(
    userId: string,
    dto?: EvaluateGapAnalysisDto,
  ): Promise<CareerGapAnalysisDto> {
    const result = await this.intelligenceService.evaluateGapAnalysis(
      userId,
      dto?.targetRoleId,
    );

    await this.eventPublisher.publish({
      userId,
      eventType: 'CareerGapEvaluated',
      aggregateType: 'career_profile',
      aggregateId: result.targetRoleId || userId,
      payload: {
        targetRoleId: result.targetRoleId,
        readinessScore: result.readinessScore,
        statedReadiness: result.statedReadiness,
        evidenceAlignmentScore: result.evidenceAlignmentScore,
        readinessDiscrepancy: result.readinessDiscrepancy,
        criticalGapsCount: result.gaps.filter((g) => g.gapSeverity === 'critical').length,
      },
    });

    return result;
  }

  // ==========================================
  // PRIVATE MAPPER HELPERS
  // ==========================================
  private mapProfileToDto(p: any): CareerProfileDto {
    return {
      id: p.id,
      userId: p.userId,
      headline: p.headline,
      currentLevel: p.currentLevel as any,
      targetTimelineMonths: p.targetTimelineMonths,
      targetCompanyTiers: (p.targetCompanyTiers as string[]) || [],
      targetLocations: (p.targetLocations as string[]) || [],
      targetCompensationRange: p.targetCompensationRange || null,
      statedReadiness: p.statedReadiness as any,
      status: p.status as any,
      metadata: p.metadata || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private mapTargetRoleToDto(r: any): CareerTargetRoleDto {
    return {
      id: r.id,
      userId: r.userId,
      title: r.title,
      roleFamily: r.roleFamily as any,
      seniorityLevel: r.seniorityLevel as any,
      priority: r.priority as any,
      targetCompanyTypes: (r.targetCompanyTypes as string[]) || [],
      description: r.description,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private mapEvidenceToDto(e: any): SkillEvidenceDto {
    return {
      id: e.id,
      userSkillId: e.userSkillId,
      userId: e.userId,
      evidenceType: e.evidenceType as any,
      title: e.title,
      description: e.description,
      url: e.url,
      validationStatus: e.validationStatus as any,
      verifiedAt: e.verifiedAt ? e.verifiedAt.toISOString() : null,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }
}
