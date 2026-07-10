import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { PaymentsService } from './payments.service';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';
import { PayCashDto, MarkCashReceivedDto } from './dto/cash-payment.dto';
import {
  CreateSubscriptionOrderDto,
  VerifySubscriptionPaymentDto,
} from './dto/subscription-payment.dto';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async createOrder(
    @Body() dto: CreatePaymentOrderDto,
    @Req() req: AuthRequest,
  ) {
    return this.paymentsService.createOrderForBooking(
      dto.bookingId,
      req.user.id,
      req.user.role,
    );
  }

  @Post('subscription-order')
  @Roles(UserRole.PROVIDER)
  async createSubscriptionOrder(
    @Body() dto: CreateSubscriptionOrderDto,
    @Req() req: AuthRequest,
  ) {
    return this.paymentsService.createOrderForSubscription(
      dto.planId,
      req.user.id,
    );
  }

  @Post('subscription/verify')
  @Roles(UserRole.PROVIDER)
  @HttpCode(HttpStatus.OK)
  async verifySubscription(
    @Body() dto: VerifySubscriptionPaymentDto,
    @Req() req: AuthRequest,
  ) {
    return this.paymentsService.verifySubscriptionPayment(
      dto.planId,
      req.user.id,
      dto.razorpayPaymentId,
      dto.razorpayOrderId,
      dto.razorpaySignature,
    );
  }

  @Get(':id/status')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  async getStatus(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.paymentsService.getPaymentStatus(
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Post('pay-cash')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async payCash(@Body() dto: PayCashDto, @Req() req: AuthRequest) {
    return this.paymentsService.payCash(
      dto.bookingId,
      req.user.id,
      req.user.role,
    );
  }

  @Post('mark-cash-received')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async markCashReceived(
    @Body() dto: MarkCashReceivedDto,
    @Req() req: AuthRequest,
  ) {
    return this.paymentsService.markCashReceived(
      dto.bookingId,
      req.user.id,
      req.user.role,
    );
  }
}
