import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApplyReferralDto } from './dto/referral.dto';

interface AuthRequest {
  user: { id: string };
}

@ApiTags('Referrals')
@ApiBearerAuth()
@Controller('referrals')
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('my-code')
  @ApiOperation({ summary: 'Get or create referral code' })
  @ApiResponse({ status: 200, description: 'Returns referral code and stats' })
  getMyCode(@Req() req: AuthRequest) {
    return this.referralsService.getOrCreateReferralCode(req.user.id);
  }

  @Post('apply')
  @ApiOperation({ summary: 'Apply a referral code' })
  @ApiResponse({ status: 201, description: 'Referral applied, wallet credited' })
  @ApiResponse({ status: 400, description: 'Invalid or own code' })
  applyCode(@Req() req: AuthRequest, @Body() dto: ApplyReferralDto) {
    return this.referralsService.applyReferralCode(req.user.id, dto.referralCode);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get referral statistics' })
  getStats(@Req() req: AuthRequest) {
    return this.referralsService.getReferralStats(req.user.id);
  }
}
