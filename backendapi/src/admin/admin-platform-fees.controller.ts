import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { PlatformFeesService } from '../platform-fees/platform-fees.service';
import { UpdateFeeConfigDto } from '../platform-fees/dto/update-fee-config.dto';
import { CreateSubscriptionPlanDto } from '../platform-fees/dto/create-subscription-plan.dto';
import { CreatePromoCodeDto } from '../platform-fees/dto/create-promo-code.dto';
import { CreateMembershipPlanDto } from '../platform-fees/dto/create-membership-plan.dto';

interface AuthenticatedRequest {
  user: { id: string; phone: string; role: UserRole };
}

@ApiTags('Admin - Platform Fees')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPlatformFeesController {
  constructor(private readonly platformFeesService: PlatformFeesService) {}

  // ─── Fee Configs ─────────────────────────────────────────────

  @Get('fee-configs')
  @ApiOperation({ summary: 'Get all fee configurations' })
  getAllConfigs() {
    return this.platformFeesService.getAllConfigs();
  }

  @Patch('fee-configs/:key')
  @ApiOperation({ summary: 'Update a fee configuration' })
  updateConfig(
    @Param('key') key: string,
    @Body() dto: UpdateFeeConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformFeesService.updateConfig(
      key,
      dto.configValue,
      dto.isActive,
      req.user.id,
    );
  }

  // ─── Subscription Plans ──────────────────────────────────────

  @Get('subscription-plans')
  @ApiOperation({ summary: 'Get all subscription plans' })
  getAllPlans() {
    return this.platformFeesService.getAllSubscriptionPlans();
  }

  @Post('subscription-plans')
  @ApiOperation({ summary: 'Create a subscription plan' })
  createPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return this.platformFeesService.createSubscriptionPlan(dto);
  }

  @Patch('subscription-plans/:id')
  @ApiOperation({ summary: 'Update a subscription plan' })
  updatePlan(
    @Param('id') id: string,
    @Body() dto: Partial<CreateSubscriptionPlanDto>,
  ) {
    return this.platformFeesService.updateSubscriptionPlan(id, dto);
  }

  @Delete('subscription-plans/:id')
  @ApiOperation({ summary: 'Delete a subscription plan' })
  deletePlan(@Param('id') id: string) {
    return this.platformFeesService.deleteSubscriptionPlan(id);
  }

  @Post('subscription-plans/:id/assign/:providerId')
  @ApiOperation({ summary: 'Assign a subscription plan to a provider' })
  assignPlan(
    @Param('id') id: string,
    @Param('providerId') providerId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformFeesService.assignSubscription(
      providerId,
      id,
      req.user.id,
    );
  }

  // ─── Promo Codes ─────────────────────────────────────────────

  @Get('promo-codes')
  @ApiOperation({ summary: 'Get all promo codes' })
  getAllPromoCodes() {
    return this.platformFeesService.getAllPromoCodes();
  }

  @Post('promo-codes')
  @ApiOperation({ summary: 'Create a promo code' })
  createPromoCode(@Body() dto: CreatePromoCodeDto) {
    return this.platformFeesService.createPromoCode(dto);
  }

  @Patch('promo-codes/:id')
  @ApiOperation({ summary: 'Update a promo code' })
  updatePromoCode(
    @Param('id') id: string,
    @Body() dto: Partial<CreatePromoCodeDto>,
  ) {
    return this.platformFeesService.updatePromoCode(id, dto);
  }

  @Delete('promo-codes/:id')
  @ApiOperation({ summary: 'Delete a promo code' })
  deletePromoCode(@Param('id') id: string) {
    return this.platformFeesService.deletePromoCode(id);
  }

  @Get('promo-codes/:id/usage')
  @ApiOperation({ summary: 'Get promo code usage history' })
  getPromoCodeUsage(@Param('id') id: string) {
    return this.platformFeesService.getPromoCodeUsageHistory(id);
  }

  // ─── Revenue Stats ───────────────────────────────────────────

  @Get('revenue-stats')
  @ApiOperation({ summary: 'Get revenue statistics' })
  getRevenueStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.platformFeesService.getRevenueStats(startDate, endDate);
  }

  // ─── Customer Membership Plans ────────────────────────────────

  @Get('membership-plans')
  @ApiOperation({ summary: 'Get all customer membership plans' })
  getAllMembershipPlans() {
    return this.platformFeesService.getAllMembershipPlans();
  }

  @Post('membership-plans')
  @ApiOperation({ summary: 'Create a customer membership plan' })
  createMembershipPlan(@Body() dto: CreateMembershipPlanDto) {
    return this.platformFeesService.createMembershipPlan(dto);
  }

  @Patch('membership-plans/:id')
  @ApiOperation({ summary: 'Update a customer membership plan' })
  updateMembershipPlan(
    @Param('id') id: string,
    @Body() dto: Partial<CreateMembershipPlanDto>,
  ) {
    return this.platformFeesService.updateMembershipPlan(id, dto);
  }

  @Delete('membership-plans/:id')
  @ApiOperation({ summary: 'Delete a customer membership plan' })
  deleteMembershipPlan(@Param('id') id: string) {
    return this.platformFeesService.deleteMembershipPlan(id);
  }

  @Post('membership-plans/:id/assign/:customerId')
  @ApiOperation({ summary: 'Assign a membership plan to a customer' })
  assignMembership(
    @Param('id') id: string,
    @Param('customerId') customerId: string,
    @Req() req: AuthenticatedRequest,
    @Query('billingCycle') billingCycle: 'monthly' | 'yearly' = 'monthly',
  ) {
    return this.platformFeesService.assignCustomerMembership(
      customerId,
      id,
      billingCycle,
      req.user.id,
    );
  }

  @Post('customer-memberships/:id/cancel')
  @ApiOperation({ summary: 'Cancel a customer membership' })
  cancelCustomerMembership(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.platformFeesService.cancelCustomerMembership(id, req.user.id);
  }

  @Get('customer-memberships/:customerId')
  @ApiOperation({ summary: "Get a customer's active membership" })
  getCustomerMembership(@Param('customerId') customerId: string) {
    return this.platformFeesService.getCustomerMembership(customerId);
  }
}
