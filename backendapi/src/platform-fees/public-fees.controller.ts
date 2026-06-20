import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformFeesService } from './platform-fees.service';
import { Provider } from '../users/entities/provider.entity';

interface AuthenticatedRequest {
  user: { id: string; phone: string; role: string };
}

@ApiTags('Platform Fees - Public')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PublicFeesController {
  constructor(
    private readonly platformFeesService: PlatformFeesService,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  private async resolveProviderId(userId: string): Promise<string> {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }
    return provider.id;
  }

  // ─── Provider Subscriptions (Self-Service) ───────────────────

  @Get('subscription-plans')
  @ApiOperation({ summary: 'List active subscription plans for providers' })
  getAllPlans() {
    return this.platformFeesService.getAllSubscriptionPlans();
  }

  @Post('subscription-plans/:id/subscribe')
  @ApiOperation({ summary: 'Subscribe current provider to a plan' })
  async subscribe(
    @Param('id') planId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const providerId = await this.resolveProviderId(req.user.id);
    return this.platformFeesService.assignSubscription(
      providerId,
      planId,
    );
  }

  @Delete('subscription-plans/cancel')
  @ApiOperation({ summary: 'Cancel current provider subscription' })
  async cancelSubscription(@Req() req: AuthenticatedRequest) {
    const providerId = await this.resolveProviderId(req.user.id);
    const sub = await this.platformFeesService.getProviderSubscription(
      providerId,
    );
    if (sub) {
      await this.platformFeesService.cancelSubscription(sub.id);
    }
    return { message: 'Subscription cancelled' };
  }

  @Get('subscription-plans/my')
  @ApiOperation({ summary: 'Get current provider subscription' })
  async getMySubscription(@Req() req: AuthenticatedRequest) {
    const providerId = await this.resolveProviderId(req.user.id);
    return this.platformFeesService.getProviderSubscription(providerId);
  }

  // ─── Customer Memberships (Self-Service) ─────────────────────

  @Get('membership-plans')
  @ApiOperation({ summary: 'List active membership plans for customers' })
  getAllMembershipPlans() {
    return this.platformFeesService.getAllMembershipPlans();
  }

  @Post('membership-plans/:id/join')
  @ApiOperation({ summary: 'Join a membership plan as a customer' })
  joinMembership(
    @Param('id') planId: string,
    @Body() body: { billingCycle?: 'monthly' | 'yearly' },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformFeesService.assignCustomerMembership(
      req.user.id,
      planId,
      body.billingCycle || 'monthly',
    );
  }

  @Delete('membership-plans/cancel')
  @ApiOperation({ summary: 'Cancel current customer membership' })
  async cancelMembership(@Req() req: AuthenticatedRequest) {
    const membership = await this.platformFeesService.getCustomerMembership(
      req.user.id,
    );
    if (membership) {
      await this.platformFeesService.cancelCustomerMembership(membership.id);
    }
    return { message: 'Membership cancelled' };
  }

  @Get('membership-plans/my')
  @ApiOperation({ summary: 'Get current customer membership with fee waiver info' })
  async getMyMembership(@Req() req: AuthenticatedRequest) {
    const membership = await this.platformFeesService.getCustomerMembership(
      req.user.id,
    );
    if (membership) {
      const waiver = await this.platformFeesService.getCustomerFeeWaiver(
        req.user.id,
      );
      return { membership, waiver };
    }
    return null;
  }
}
