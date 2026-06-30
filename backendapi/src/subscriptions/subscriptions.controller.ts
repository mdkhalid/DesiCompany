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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPlan } from './entities/subscription.entity';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get available subscription plans' })
  async getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Get('current')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Get current active subscription' })
  async getCurrentSubscription(@Req() req: any) {
    return this.subscriptionsService.getCurrentSubscription(req.user.id);
  }

  @Post('subscribe')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Subscribe to a plan' })
  async subscribe(
    @Req() req: any,
    @Body('plan') plan: SubscriptionPlan,
  ) {
    return this.subscriptionsService.subscribe(req.user.id, plan);
  }

  @Delete('cancel')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Cancel current subscription' })
  async cancelSubscription(@Req() req: any) {
    return this.subscriptionsService.cancelSubscription(req.user.id);
  }

  @Get('history')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Get subscription history' })
  async getSubscriptionHistory(@Req() req: any) {
    return this.subscriptionsService.getSubscriptionHistory(req.user.id);
  }

  @Get('benefits/:providerId')
  @ApiOperation({ summary: 'Get provider subscription benefits' })
  async getProviderBenefits(@Param('providerId') providerId: string) {
    return this.subscriptionsService.getProviderSubscriptionBenefits(providerId);
  }
}
