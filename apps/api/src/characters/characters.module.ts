import { Module } from '@nestjs/common';
import { CharacterRepository } from './character.repository';
import { CharactersService } from './characters.service';
import { CharactersController } from './characters.controller';

@Module({
  controllers: [CharactersController],
  providers: [CharacterRepository, CharactersService],
  exports: [CharacterRepository, CharactersService],
})
export class CharactersModule {}
