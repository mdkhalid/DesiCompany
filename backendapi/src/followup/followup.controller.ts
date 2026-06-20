import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FollowUpService } from './followup.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Follow-up')
@ApiBearerAuth()
@Controller('followup')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FollowUpController {
  constructor(private readonly followUpService: FollowUpService) {}

  @Post('review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Send review follow-ups for completed bookings' })
  sendReviewFollowUps() {
    return this.followUpService.sendReviewFollowUps();
  }

  @Post('reengagement')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Send re-engagement follow-ups to inactive customers' })
  sendReengagement() {
    return this.followUpService.sendReengagementFollowUps();
  }
}