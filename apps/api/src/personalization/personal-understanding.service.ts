import { Injectable, Logger } from '@nestjs/common';
import { PersonalUnderstandingRepository } from './personal-understanding.repository';
import {
  UserProfileDto,
  UpdateUserProfileDto,
  AttributeConfidenceMetadata,
} from '@niva/shared-types';
import { UserProfile } from '../database/schema/user-profiles';

@Injectable()
export class PersonalUnderstandingService {
  private readonly logger = new Logger(PersonalUnderstandingService.name);

  constructor(
    private readonly repository: PersonalUnderstandingRepository,
  ) {}

  /**
   * Retrieves the user's consolidated personal understanding profile.
   * If not created yet, returns an empty structured profile.
   */
  async getProfile(userId: string): Promise<UserProfileDto> {
    const profile = await this.repository.findByUserId(userId);
    if (profile) {
      return this.mapToDto(profile);
    }

    // Default empty profile
    return {
      id: '',
      userId,
      education: {},
      profession: {},
      expertiseAreas: [],
      interests: [],
      dailyRoutines: {},
      communicationPreferences: {},
      learningPreferences: {},
      ongoingChallenges: [],
      importantDates: [],
      attributeConfidence: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Updates or corrects user profile attributes explicitly.
   */
  async updateProfile(userId: string, dto: UpdateUserProfileDto): Promise<UserProfileDto> {
    const existing = await this.repository.findByUserId(userId);
    const nowIso = new Date().toISOString();

    const currentConf: Record<string, AttributeConfidenceMetadata> =
      (existing?.attributeConfidence as Record<string, AttributeConfidenceMetadata>) || {};

    // Helper to stamp explicit user updates with 1.0 confidence
    const markExplicit = (key: string) => {
      currentConf[key] = {
        confidence: 1.0,
        confidenceType: 'explicit',
        provenance: 'user_direct_edit',
        updatedAt: nowIso,
      };
    };

    const newEducation = {
      ...((existing?.education as Record<string, any>) || {}),
      ...(dto.education || {}),
    };
    if (dto.education) markExplicit('education');

    const newProfession = {
      ...((existing?.profession as Record<string, any>) || {}),
      ...(dto.profession || {}),
    };
    if (dto.profession) markExplicit('profession');

    const newExpertise = dto.expertiseAreas !== undefined
      ? Array.from(new Set(dto.expertiseAreas))
      : ((existing?.expertiseAreas as string[]) || []);
    if (dto.expertiseAreas) markExplicit('expertiseAreas');

    const newInterests = dto.interests !== undefined
      ? Array.from(new Set(dto.interests))
      : ((existing?.interests as string[]) || []);
    if (dto.interests) markExplicit('interests');

    const newRoutines = {
      ...((existing?.dailyRoutines as Record<string, any>) || {}),
      ...(dto.dailyRoutines || {}),
    };
    if (dto.dailyRoutines) markExplicit('dailyRoutines');

    const newComm = {
      ...((existing?.communicationPreferences as Record<string, any>) || {}),
      ...(dto.communicationPreferences || {}),
    };
    if (dto.communicationPreferences) markExplicit('communicationPreferences');

    const newLearning = {
      ...((existing?.learningPreferences as Record<string, any>) || {}),
      ...(dto.learningPreferences || {}),
    };
    if (dto.learningPreferences) markExplicit('learningPreferences');

    const newChallenges = dto.ongoingChallenges !== undefined
      ? dto.ongoingChallenges
      : ((existing?.ongoingChallenges as any[]) || []);
    if (dto.ongoingChallenges) markExplicit('ongoingChallenges');

    const newDates = dto.importantDates !== undefined
      ? dto.importantDates
      : ((existing?.importantDates as any[]) || []);
    if (dto.importantDates) markExplicit('importantDates');

    const saved = await this.repository.upsertProfile(userId, {
      education: newEducation,
      profession: newProfession,
      expertiseAreas: newExpertise,
      interests: newInterests,
      dailyRoutines: newRoutines,
      communicationPreferences: newComm,
      learningPreferences: newLearning,
      ongoingChallenges: newChallenges,
      importantDates: newDates,
      attributeConfidence: currentConf,
    });

    this.logger.log(`Updated user profile for user ${userId}`);
    return this.mapToDto(saved);
  }

  /**
   * Deletes an attribute from user profile.
   */
  async deleteAttribute(userId: string, attributeKey: string): Promise<UserProfileDto> {
    const existing = await this.repository.findByUserId(userId);
    if (!existing) {
      return this.getProfile(userId);
    }

    const currentConf = { ...((existing.attributeConfidence as Record<string, any>) || {}) };
    delete currentConf[attributeKey];

    const updates: Record<string, any> = { attributeConfidence: currentConf };
    if (attributeKey === 'education') updates.education = {};
    if (attributeKey === 'profession') updates.profession = {};
    if (attributeKey === 'expertiseAreas') updates.expertiseAreas = [];
    if (attributeKey === 'interests') updates.interests = [];
    if (attributeKey === 'dailyRoutines') updates.dailyRoutines = {};
    if (attributeKey === 'communicationPreferences') updates.communicationPreferences = {};
    if (attributeKey === 'learningPreferences') updates.learningPreferences = {};
    if (attributeKey === 'ongoingChallenges') updates.ongoingChallenges = [];
    if (attributeKey === 'importantDates') updates.importantDates = [];

    const saved = await this.repository.upsertProfile(userId, updates);
    return this.mapToDto(saved);
  }

  /**
   * Naturally learns background information or corrections from conversation turns.
   * Distinguishes explicit user statements from inferences, recording provenance.
   */
  async learnFromConversation(
    userId: string,
    userMessage: string,
  ): Promise<UserProfileDto | null> {
    const text = userMessage.trim();
    const lower = text.toLowerCase();
    const nowIso = new Date().toISOString();

    const updates: Partial<UpdateUserProfileDto> = {};
    const newConf: Record<string, AttributeConfidenceMetadata> = {};

    // 1. Education extraction
    const eduMatch1 = text.match(/(?:i'm\s+a|i\s+am\s+a)\s+(?:(?:\d+(?:st|nd|rd|th)?|[a-zA-Z-]+)\s+year\s+)?([a-zA-Z\s]+?)\s+student(?:\s+at\s+([a-zA-Z\s]+?))?(?:[.!?,\n]|\s+(?:and|with|who|but)\b|$)/i);
    const eduMatch2 = text.match(/(?:i'm\s+studying|i\s+study|major\s+in|majoring\s+in)\s+([a-zA-Z\s]+?)(?:\s+at\s+([a-zA-Z\s]+?))?(?:[.!?,\n]|\s+(?:and|with|who|but)\b|$)/i);
    const eduMatch = eduMatch1 || eduMatch2;
    if (eduMatch) {
      const field = eduMatch[1]?.trim();
      const institution = eduMatch[2]?.trim();
      if (field && field.length > 2 && field.length < 50) {
        updates.education = {
          fieldOfStudy: field,
          ...(institution ? { institution } : {}),
        };
        newConf['education'] = {
          confidence: 0.95,
          confidenceType: 'explicit',
          provenance: `User message: "${text.substring(0, 60)}"`,
          updatedAt: nowIso,
        };
      }
    }

    // 2. Profession / Target Role extraction
    const targetMatch = text.match(/(?:preparing\s+for|aiming\s+for|targeting)\s+([a-zA-Z\s]+?)(?:\s+roles|\s+jobs|\s+positions)?(?:[.!?,\n]|$)/i);
    if (targetMatch && targetMatch[1]) {
      const target = targetMatch[1].trim();
      if (target.length > 2 && target.length < 60) {
        updates.profession = {
          ...((updates.profession as any) || {}),
          targetRole: target,
        };
        newConf['profession'] = {
          confidence: 0.90,
          confidenceType: 'explicit',
          provenance: `User message: "${text.substring(0, 60)}"`,
          updatedAt: nowIso,
        };
      }
    }

    const profMatch = text.match(/(?:i\s+work\s+as\s+a|i'm\s+a|i\s+am\s+a)\s+([a-zA-Z\s]+?)(?:\s+at\s+([a-zA-Z\s]+))?(?:[.!?,\n]|$)/i);
    if (profMatch && !eduMatch) {
      const role = (profMatch[1] || '').trim();
      const company = profMatch[2] ? profMatch[2].trim() : undefined;
      const nonRoles = ['doing well', 'good', 'fine', 'tired', 'exhausted', 'here', 'back', 'ready', 'student'];
      if (role && role.length > 2 && role.length < 50 && !nonRoles.includes(role.toLowerCase())) {
        updates.profession = {
          ...((updates.profession as any) || {}),
          currentRole: role,
          ...(company ? { company } : {}),
        };
        newConf['profession'] = {
          confidence: 0.95,
          confidenceType: 'explicit',
          provenance: `User message: "${text.substring(0, 60)}"`,
          updatedAt: nowIso,
        };
      }
    }

    // 3. Technical expertise / Tech stack
    const techStackKeywords = [
      'go', 'golang', 'python', 'rust', 'typescript', 'distributed systems',
      'docker', 'kubernetes', 'postgres', 'redis', 'machine learning', 'system design'
    ];
    const foundTech = techStackKeywords.filter((k) => {
      const reg = new RegExp(`\\b${k}\\b`, 'i');
      return reg.test(text);
    });
    if (foundTech.length > 0) {
      updates.expertiseAreas = foundTech.map((t) => t === 'go' ? 'Go' : t.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
      newConf['expertiseAreas'] = {
        confidence: 0.90,
        confidenceType: 'explicit',
        provenance: `User message: "${text.substring(0, 60)}"`,
        updatedAt: nowIso,
      };
    }

    // 4. Daily Routines (Wake time, focus hours)
    const wakeMatch = text.match(/(?:i\s+wake\s+up\s+at|wake\s+up\s+around|morning\s+routine\s+starts\s+at)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (wakeMatch && wakeMatch[1]) {
      updates.dailyRoutines = {
        wakeTime: wakeMatch[1].trim(),
      };
      newConf['dailyRoutines'] = {
        confidence: 0.90,
        confidenceType: 'explicit',
        provenance: `User message: "${text.substring(0, 60)}"`,
        updatedAt: nowIso,
      };
    } else if (lower.includes('early morning')) {
      updates.dailyRoutines = {
        peakFocusHours: 'Early morning',
      };
      newConf['dailyRoutines'] = {
        confidence: 0.85,
        confidenceType: 'explicit',
        provenance: `User message: "${text.substring(0, 60)}"`,
        updatedAt: nowIso,
      };
    } else if (lower.includes('late at night') || lower.includes('late night') || lower.includes('night owl')) {
      updates.dailyRoutines = {
        peakFocusHours: 'Late night',
      };
      newConf['dailyRoutines'] = {
        confidence: 0.90,
        confidenceType: 'explicit',
        provenance: `User message: "${text.substring(0, 60)}"`,
        updatedAt: nowIso,
      };
    }

    // 5. Communication preference
    if (lower.includes('bullet') || lower.includes('bullet-point') || lower.includes('bullet points')) {
      updates.communicationPreferences = {
        format: 'bullet_points',
        directness: 'high',
      };
      newConf['communicationPreferences'] = {
        confidence: 0.95,
        confidenceType: 'explicit',
        provenance: `User message: "${text.substring(0, 60)}"`,
        updatedAt: nowIso,
      };
    } else if (lower.includes('keep it concise') || lower.includes('be concise') || lower.includes('brief answers')) {
      updates.communicationPreferences = {
        format: 'concise',
        directness: 'high',
      };
      newConf['communicationPreferences'] = {
        confidence: 1.0,
        confidenceType: 'explicit',
        provenance: `User message: "${text.substring(0, 60)}"`,
        updatedAt: nowIso,
      };
    }

    // 6. Learning preference
    if (lower.includes('first principles') || lower.includes('active recall') || lower.includes('code examples')) {
      const style = lower.includes('first principles')
        ? 'first_principles'
        : lower.includes('code examples')
        ? 'applied_examples'
        : 'active_recall';
      updates.learningPreferences = { style };
      newConf['learningPreferences'] = {
        confidence: 0.90,
        confidenceType: 'explicit',
        provenance: `User message: "${text.substring(0, 60)}"`,
        updatedAt: nowIso,
      };
    } else if (lower.includes('lo-fi') || lower.includes('lofi') || lower.includes('ambient music')) {
      updates.interests = ['Lo-fi Music'];
      newConf['interests'] = {
        confidence: 0.90,
        confidenceType: 'explicit',
        provenance: `User message: "${text.substring(0, 60)}"`,
        updatedAt: nowIso,
      };
    }

    // If no attributes detected, return null
    if (Object.keys(updates).length === 0) {
      return null;
    }

    const existing = await this.repository.findByUserId(userId);
    const existingConf = ((existing?.attributeConfidence as Record<string, AttributeConfidenceMetadata>) || {});
    const mergedConf = { ...existingConf, ...newConf };

    const mergedData = {
      ...(updates.education ? { education: { ...((existing?.education as any) || {}), ...updates.education } } : {}),
      ...(updates.profession ? { profession: { ...((existing?.profession as any) || {}), ...updates.profession } } : {}),
      ...(updates.expertiseAreas ? {
        expertiseAreas: Array.from(new Set([...((existing?.expertiseAreas as string[]) || []), ...updates.expertiseAreas]))
      } : {}),
      ...(updates.dailyRoutines ? { dailyRoutines: { ...((existing?.dailyRoutines as any) || {}), ...updates.dailyRoutines } } : {}),
      ...(updates.communicationPreferences ? { communicationPreferences: { ...((existing?.communicationPreferences as any) || {}), ...updates.communicationPreferences } } : {}),
      ...(updates.learningPreferences ? { learningPreferences: { ...((existing?.learningPreferences as any) || {}), ...updates.learningPreferences } } : {}),
      attributeConfidence: mergedConf,
    };

    const saved = await this.repository.upsertProfile(userId, mergedData);
    this.logger.log(`Naturally learned attributes for user ${userId}: ${Object.keys(updates).join(', ')}`);
    return this.mapToDto(saved);
  }

  private mapToDto(profile: UserProfile): UserProfileDto {
    return {
      id: profile.id,
      userId: profile.userId,
      education: (profile.education as any) || {},
      profession: (profile.profession as any) || {},
      expertiseAreas: (profile.expertiseAreas as string[]) || [],
      interests: (profile.interests as string[]) || [],
      dailyRoutines: (profile.dailyRoutines as any) || {},
      communicationPreferences: (profile.communicationPreferences as any) || {},
      learningPreferences: (profile.learningPreferences as any) || {},
      ongoingChallenges: (profile.ongoingChallenges as any[]) || [],
      importantDates: (profile.importantDates as any[]) || [],
      attributeConfidence: (profile.attributeConfidence as Record<string, AttributeConfidenceMetadata>) || {},
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
