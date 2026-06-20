import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthRequest {
  user: { id: string };
}

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('me')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current user loyalty status' })
  getMyLoyalty(@Req() req: AuthRequest) {
    return this.loyaltyService.getOrCreateLoyalty(req.user.id);
  }

  @Post('redeem')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Redeem loyalty points for wallet credit' })
  @ApiResponse({ status: 200, description: 'Points redeemed' })
  redeemPoints(@Req() req: AuthRequest, @Body('points') points: number) {
    return this.loyaltyService.redeemPoints(req.user.id, points);
  }

  @Get('leaderboard')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get top users by loyalty points' })
  getLeaderboard(@Query('limit') limit?: number) {
    return this.loyaltyService.getLeaderboard(limit);
  }

  @Get('all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all loyalty users (admin)' })
  getAll(@Query('role') role?: UserRole) {
    return this.loyaltyService.getAllLoyaltyUsers(role);
  }
}
