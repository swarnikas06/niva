import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CharactersModule } from '../characters/characters.module';
import { PersonalizationRepository } from './personalization.repository';
import { PersonalizationService } from './personalization.service';
import { PersonalUnderstandingRepository } from './personal-understanding.repository';
import { PersonalUnderstandingService } from './personal-understanding.service';
import { PersonalizationController } from './personalization.controller';

@Module({
  imports: [AuthModule, CharactersModule],
  controllers: [PersonalizationController],
  providers: [
    PersonalizationRepository,
    PersonalizationService,
    PersonalUnderstandingRepository,
    PersonalUnderstandingService,
  ],
  exports: [
    PersonalizationRepository,
    PersonalizationService,
    PersonalUnderstandingRepository,
    PersonalUnderstandingService,
  ],
})
export class PersonalizationModule {}
