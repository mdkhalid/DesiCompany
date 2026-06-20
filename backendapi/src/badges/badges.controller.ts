import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BadgesService } from './badges.service';

@ApiTags('Badges')
@Controller('badges')
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get('metadata')
  @ApiOperation({ summary: 'Get badge types and metadata' })
  getMetadata() {
    return this.badgesService.getBadgeMetadata();
  }

  @Get('provider/:providerId')
  @ApiOperation({ summary: 'Get badges for a specific provider' })
  getProviderBadges(@Param('providerId') providerId: string) {
    return this.badgesService.getProviderWithBadges(providerId);
  }
}