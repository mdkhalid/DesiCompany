import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPlan } from './entities/subscription.entity';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get available subscription plans' })
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Get('current')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Get current active subscription' })
  async getCurrentSubscription(@Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.getCurrentSubscription(req.user.id);
  }

  @Post('subscribe')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Subscribe to a plan' })
  async subscribe(
    @Req() req: AuthenticatedRequest,
    @Body('plan') plan: SubscriptionPlan,
  ) {
    return this.subscriptionsService.subscribe(req.user.id, plan);
  }

  @Delete('cancel')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Cancel current subscription' })
  async cancelSubscription(@Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.cancelSubscription(req.user.id);
  }

  @Get('history')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Get subscription history' })
  async getSubscriptionHistory(@Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.getSubscriptionHistory(req.user.id);
  }

  @Get('benefits/:providerId')
  @ApiOperation({ summary: 'Get provider subscription benefits' })
  async getProviderBenefits(@Param('providerId') providerId: string) {
    return this.subscriptionsService.getProviderSubscriptionBenefits(
      providerId,
    );
  }
}
