import { Injectable, NotFoundException } from '@nestjs/common';
import { CharacterRepository } from './character.repository';
import { CharacterArchetypeDto, ProactivityLevel, ResponseLength } from '@niva/shared-types';
import { CharacterArchetype } from '../database/schema';

@Injectable()
export class CharactersService {
  constructor(private readonly characterRepository: CharacterRepository) {}

  async getAllActive(): Promise<CharacterArchetypeDto[]> {
    const list = await this.characterRepository.findAllActive();
    return list.map((item) => this.toDto(item));
  }

  async getById(id: string): Promise<CharacterArchetypeDto> {
    const archetype = await this.characterRepository.findById(id);
    if (!archetype || !archetype.isActive) {
      throw new NotFoundException(`Character archetype '${id}' not found`);
    }
    return this.toDto(archetype);
  }

  private toDto(item: CharacterArchetype): CharacterArchetypeDto {
    return {
      id: item.id,
      name: item.name,
      tagline: item.tagline,
      description: item.description,
      detailedPersonality: item.detailedPersonality || undefined,
      communicationStyle: item.communicationStyle || undefined,
      preferredStructure: item.preferredStructure || undefined,
      accentColor: item.accentColor || '#2563EB',
      avatarId: item.avatarId || 'default',
      voicePreference: (item.voicePreference as any) || undefined,
      traits: {
        warmth: item.defaultWarmth,
        directness: item.defaultDirectness,
        humor: item.defaultHumor,
        challengeLevel: item.defaultChallengeLevel,
        proactivity: item.defaultProactivity as ProactivityLevel,
        responseLength: item.defaultResponseLength as ResponseLength,
      },
      sampleDialogue: item.sampleDialogue,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    };
  }
}
