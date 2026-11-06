import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse } from '@nestjs/swagger';
import { CharactersService } from './characters.service';
import { CharacterArchetypeDto } from '@niva/shared-types';

@ApiTags('Characters')
@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active character archetypes' })
  @SwaggerApiResponse({ status: 200, description: 'Active character archetypes returned' })
  async getCharacters(): Promise<CharacterArchetypeDto[]> {
    return this.charactersService.getAllActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get character archetype by ID' })
  @SwaggerApiResponse({ status: 200, description: 'Character archetype details returned' })
  @SwaggerApiResponse({ status: 404, description: 'Character archetype not found' })
  async getCharacterById(@Param('id') id: string): Promise<CharacterArchetypeDto> {
    return this.charactersService.getById(id);
  }
}
