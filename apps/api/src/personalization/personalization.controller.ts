import {
  Controller,
  Get,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AuthenticatedPrincipal,
  UserPersonalizationDto,
  UserProfileDto,
  UpdateUserProfileDto,
} from '@niva/shared-types';
import { PersonalizationService } from './personalization.service';
import { PersonalUnderstandingService } from './personal-understanding.service';
import { OnboardingUpdateDto } from './dto/onboarding-update.dto';
import { PersonalizationUpdateDto } from './dto/personalization-update.dto';

@ApiTags('Personalization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('personalization')
export class PersonalizationController {
  constructor(
    private readonly personalizationService: PersonalizationService,
    private readonly personalUnderstandingService: PersonalUnderstandingService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: "Get authenticated user's personalization (Read-Only)" })
  @SwaggerApiResponse({ status: 200, description: 'Personalization profile returned' })
  async getMyPersonalization(
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<UserPersonalizationDto> {
    return this.personalizationService.getPersonalization(user.userId);
  }

  @Get('profile')
  @ApiOperation({ summary: "Get user's evolving personal understanding profile" })
  @SwaggerApiResponse({ status: 200, description: 'Consolidated personal understanding profile' })
  async getProfile(
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<UserProfileDto> {
    return this.personalUnderstandingService.getProfile(user.userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update or correct personal understanding attributes' })
  @SwaggerApiResponse({ status: 200, description: 'Updated personal profile' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: UpdateUserProfileDto,
  ): Promise<UserProfileDto> {
    return this.personalUnderstandingService.updateProfile(user.userId, dto);
  }

  @Delete('profile/attributes/:key')
  @ApiOperation({ summary: 'Delete or clear a specific personal understanding attribute' })
  @SwaggerApiResponse({ status: 200, description: 'Profile with attribute removed' })
  async deleteAttribute(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('key') key: string,
  ): Promise<UserProfileDto> {
    return this.personalUnderstandingService.deleteAttribute(user.userId, key);
  }

  @Put('onboarding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Progressively save or complete onboarding state' })
  @SwaggerApiResponse({ status: 200, description: 'Onboarding state updated' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid input or archetype ID' })
  async updateOnboarding(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: OnboardingUpdateDto,
  ): Promise<UserPersonalizationDto> {
    return this.personalizationService.updateOnboarding(user.userId, dto);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update personalization preferences from settings' })
  @SwaggerApiResponse({ status: 200, description: 'Personalization updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid input or archetype ID' })
  async updatePersonalization(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: PersonalizationUpdateDto,
  ): Promise<UserPersonalizationDto> {
    return this.personalizationService.updatePersonalization(user.userId, dto);
  }
}
