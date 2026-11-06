import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedPrincipal } from '@niva/shared-types';
import { CompanionStateService } from './companion-state.service';
import { UpdateCompanionStateDto } from './dto/companion-state.dto';

@ApiTags('Companion State')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('companion-state')
export class CompanionStateController {
  constructor(private readonly service: CompanionStateService) {}

  @Get()
  @ApiOperation({ summary: 'Get current companion operational state' })
  @SwaggerApiResponse({ status: 200, description: 'Companion state returned' })
  async getCompanionState(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.getCompanionState(user.userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update companion presence, interaction mode, or active focus' })
  @SwaggerApiResponse({ status: 200, description: 'Companion state updated' })
  async updateCompanionState(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: UpdateCompanionStateDto,
  ) {
    return this.service.updateCompanionState(user.userId, dto);
  }
}
