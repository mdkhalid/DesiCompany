import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull, Not } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from './entities/payment.entity';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { PaymentGatewayType } from '../common/enums/payment-gateway-type.enum';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { TransactionSource } from '../common/enums/transaction-source.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { SoftBlockService } from './soft-block.service';
import { PlatformFeesService } from '../platform-fees/platform-fees.service';
import { ProviderSubscription } from '../platform-fees/entities/provider-subscription.entity';
import { ProviderSubscriptionPlan } from '../platform-fees/entities/provider-subscription-plan.entity';
import { PlatformFeeConfig } from '../platform-fees/entities/platform-fee-config.entity';
import { Provider } from '../users/entities/provider.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(ProviderSubscription)
    private readonly subscriptionRepository: Repository<ProviderSubscription>,
    @InjectRepository(ProviderSubscriptionPlan)
    private readonly planRepository: Repository<ProviderSubscriptionPlan>,
    @InjectRepository(PlatformFeeConfig)
    private readonly feeConfigRepository: Repository<PlatformFeeConfig>,
    private readonly paymentGatewayFactory: PaymentGatewayFactory,
    private readonly softBlockService: SoftBlockService,
    private readonly platformFeesService: PlatformFeesService,
  ) {}

  async createOrderForSubscription(
    planId: string,
    userId: string,
  ) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) throw new NotFoundException('Provider profile not found');

    const plan = await this.planRepository.findOne({
      where: { id: planId, isActive: true },
    });
    if (!plan) throw new NotFoundException('Subscription plan not found');

    const existingSub = await this.subscriptionRepository.findOne({
      where: { provider: { id: provider.id }, status: 'active' },
    });
    if (existingSub) {
      throw new BadRequestException('You already have an active subscription');
    }

    const featureConfig = await this.feeConfigRepository.findOne({
      where: { configKey: 'feature_provider_subscriptions' },
    });
    const isEnabled = featureConfig?.isActive !== false &&
      featureConfig?.configValue?.enabled !== false;
    if (!isEnabled) {
      throw new BadRequestException('Subscriptions are currently disabled');
    }

    const isChargeable = featureConfig?.configValue?.chargeable !== false;

    if (!isChargeable || Number(plan.price) <= 0) {
      const sub = await this.platformFeesService.assignSubscription(
        provider.id,
        planId,
      );
      return { status: 'free', subscription: sub };
    }

    const gateway = await this.paymentGatewayFactory.getDefault();
    const gatewayType = gateway.getName() as PaymentGatewayType;

    if (gatewayType === PaymentGatewayType.CASH) {
      throw new BadRequestException('Cash not supported for subscriptions');
    }

    const amountPaise = Math.round(Number(plan.price) * 100);
    const order = await gateway.createOrder({
      amount: amountPaise,
      currency: 'INR',
      bookingId: `sub_${planId}`,
      customerPhone: '',
    });

    const payment = this.paymentRepository.create({
      method: PaymentMethod.ONLINE,
      status: PaymentStatus.PENDING,
      amount: Number(plan.price),
      gateway: gatewayType,
      gatewayOrderId: order.gatewayOrderId,
      transactionId: order.gatewayOrderId,
      purposeType: 'subscription',
      purposeId: provider.id,
      metadata: { planId },
    });
    await this.paymentRepository.save(payment);

    const lastPayment = await this.paymentRepository.findOne({
      where: { purposeId: provider.id, status: PaymentStatus.SUCCESS },
      order: { createdAt: 'DESC' },
    });

    return {
      status: 'chargeable',
      gatewayOrderId: order.gatewayOrderId,
      keyId: order.keyId,
      amount: amountPaise,
      currency: order.currency,
      paymentId: payment.id,
      planId,
      preferredMethod: lastPayment?.gatewayResponse
        ? this.extractMethodFromResponse(lastPayment.gatewayResponse)
        : undefined,
    };
  }

  async verifySubscriptionPayment(
    planId: string,
    userId: string,
    razorpayPaymentId: string,
    razorpayOrderId: string,
    razorpaySignature: string,
  ): Promise<{ status: string; subscription?: any }> {
    const payment = await this.paymentRepository.findOne({
      where: { gatewayOrderId: razorpayOrderId },
    });
    if (!payment) throw new NotFoundException('Payment record not found');

    if (payment.status === PaymentStatus.SUCCESS) {
      const sub = await this.subscriptionRepository.findOne({
        where: { provider: { user: { id: userId } } },
        relations: { plan: true },
      });
      return { status: 'success', subscription: sub };
    }

    try {
      const gateway = await this.paymentGatewayFactory.getByType(payment.gateway);
      const gatewayStatus = await gateway.getStatus(razorpayOrderId);

      if (gatewayStatus.status === 'success') {
        payment.status = PaymentStatus.SUCCESS;
        payment.transactionId = razorpayPaymentId;
        payment.gatewayResponse = JSON.stringify(gatewayStatus);
        await this.paymentRepository.save(payment);

        const provider = await this.providerRepository.findOne({
          where: { user: { id: userId } },
        });

        const sub = provider
          ? await this.platformFeesService.activateSubscriptionPayment(
              provider.id,
              userId,
              payment.id,
              payment.amount,
              planId,
            )
          : null;

        return { status: 'success', subscription: sub };
      }

      if (gatewayStatus.status === 'failed') {
        payment.status = PaymentStatus.FAILED;
        payment.gatewayResponse = JSON.stringify(gatewayStatus);
        await this.paymentRepository.save(payment);
        return { status: 'failed' };
      }

      return { status: 'pending' };
    } catch (err) {
      this.logger.warn(
        `Payment verification failed for order ${razorpayOrderId}: ${(err as Error).message}`,
      );
      return { status: 'pending' };
    }
  }

  private extractMethodFromResponse(response: string): string | undefined {
    try {
      const parsed = JSON.parse(response);
      if (parsed?.method) return parsed.method;
      if (parsed?.payment_method) return parsed.payment_method;
    } catch {}
    return undefined;
  }

  @Cron('0 */15 * * * *')
  async reconcileStuckPayments() {
    this.logger.log('Running payment reconciliation...');

    const stuckPayments = await this.paymentRepository.find({
      where: {
        status: PaymentStatus.PENDING,
        gatewayOrderId: Not(IsNull()),
        createdAt: LessThan(new Date(Date.now() - 10 * 60 * 1000)),
      },
    });

    for (const payment of stuckPayments) {
      try {
        const gateway = await this.paymentGatewayFactory.getByType(payment.gateway);
        const gatewayStatus = await gateway.getStatus(payment.gatewayOrderId);

        if (gatewayStatus.status === 'success' && payment.status === PaymentStatus.PENDING) {
          payment.status = PaymentStatus.SUCCESS;
          payment.transactionId = gatewayStatus.gatewayPaymentId || payment.transactionId;
          payment.gatewayResponse = JSON.stringify(gatewayStatus);
          await this.paymentRepository.save(payment);

          if (payment.purposeType === 'subscription') {
            const providerRec = await this.providerRepository.findOne({
              where: { id: payment.purposeId },
              relations: { user: true },
            });
            const planId = (payment.metadata as Record<string, unknown>)?.planId as string | undefined;
            if (providerRec && planId) {
              await this.platformFeesService.activateSubscriptionPayment(
                providerRec.id,
                providerRec.user?.id || payment.purposeId,
                payment.id,
                payment.amount,
                planId,
              );
            }
          }

          this.logger.log(`Reconciled payment ${payment.id} — activated`);
        } else if (gatewayStatus.status === 'failed') {
          payment.status = PaymentStatus.FAILED;
          payment.gatewayResponse = JSON.stringify(gatewayStatus);
          await this.paymentRepository.save(payment);
          this.logger.log(`Reconciled payment ${payment.id} — marked failed`);
        }
      } catch (err) {
        this.logger.warn(
          `Reconciliation failed for payment ${payment.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  async createOrderForBooking(
    bookingId: string,
    userId: string,
    role: UserRole,
  ) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: {
        customer: { user: true },
        provider: { user: true },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (role === UserRole.CUSTOMER && booking.customer.user.id !== userId) {
      throw new ForbiddenException('You can only pay for your own bookings');
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Booking must be completed before payment');
    }

    const existing = await this.paymentRepository.findOne({
      where: { booking: { id: bookingId }, status: PaymentStatus.SUCCESS },
    });
    if (existing) {
      throw new ConflictException('Booking already paid');
    }

    const gateway = await this.paymentGatewayFactory.getDefault();
    const gatewayType = gateway.getName() as PaymentGatewayType;

    if (gatewayType === PaymentGatewayType.CASH) {
      return this.createCashOrder(booking, gatewayType);
    }

    const order = await gateway.createOrder({
      amount: Math.round(Number(booking.totalAmount) * 100),
      currency: 'INR',
      bookingId: booking.id,
      customerPhone: booking.customer.user.phone,
    });

    const payment = this.paymentRepository.create({
      booking,
      method: PaymentMethod.ONLINE,
      status: PaymentStatus.PENDING,
      amount: Number(booking.totalAmount),
      gateway: gatewayType,
      gatewayOrderId: order.gatewayOrderId,
      transactionId: order.gatewayOrderId,
    });
    await this.paymentRepository.save(payment);

    return {
      gatewayOrderId: order.gatewayOrderId,
      keyId: order.keyId,
      amount: order.amount,
      currency: order.currency,
      paymentId: payment.id,
    };
  }

  async getPaymentStatus(paymentId: string, userId: string, role: UserRole) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: {
        booking: { customer: { user: true }, provider: { user: true } },
      },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (role !== UserRole.ADMIN && payment.booking) {
      if (
        payment.booking.customer?.user?.id !== userId &&
        payment.booking.provider?.user?.id !== userId
      ) {
        throw new ForbiddenException('Access denied');
      }
    }

    if (payment.status !== PaymentStatus.PENDING || !payment.gatewayOrderId) {
      return {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        method: payment.method,
        gateway: payment.gateway,
      };
    }

    try {
      const gateway = await this.paymentGatewayFactory.getByType(
        payment.gateway,
      );
      const gatewayStatus = await gateway.getStatus(payment.gatewayOrderId);

      if (
        gatewayStatus.status === 'success' &&
        payment.status === PaymentStatus.PENDING
      ) {
        payment.status = PaymentStatus.SUCCESS;
        payment.gatewayResponse = JSON.stringify(gatewayStatus);
        await this.paymentRepository.save(payment);
        await this.creditProviderWallet(payment);
      } else if (
        gatewayStatus.status === 'failed' &&
        payment.status === PaymentStatus.PENDING
      ) {
        payment.status = PaymentStatus.FAILED;
        payment.gatewayResponse = JSON.stringify(gatewayStatus);
        await this.paymentRepository.save(payment);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to poll gateway for payment ${paymentId}: ${(err as Error).message}`,
      );
    }

    return {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      method: payment.method,
      gateway: payment.gateway,
    };
  }

  async payCash(bookingId: string, userId: string, role: UserRole) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: { customer: { user: true } },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (role === UserRole.CUSTOMER && booking.customer.user.id !== userId) {
      throw new ForbiddenException('You can only pay for your own bookings');
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Booking must be completed before payment');
    }

    const existing = await this.paymentRepository.findOne({
      where: { booking: { id: bookingId }, status: PaymentStatus.SUCCESS },
    });
    if (existing) {
      throw new ConflictException('Booking already paid');
    }

    return this.createCashOrder(booking, PaymentGatewayType.CASH);
  }

  async markCashReceived(bookingId: string, userId: string, role: UserRole) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: { provider: { user: true } },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (role === UserRole.PROVIDER && booking.provider.user.id !== userId) {
      throw new ForbiddenException(
        'You can only mark cash received for your own bookings',
      );
    }

    const payment = await this.paymentRepository.findOne({
      where: { booking: { id: bookingId }, method: PaymentMethod.CASH },
    });
    if (!payment) {
      throw new NotFoundException('No cash payment found for this booking');
    }
    if (payment.status === PaymentStatus.SUCCESS) {
      throw new ConflictException('Cash already marked as received');
    }

    payment.status = PaymentStatus.SUCCESS;
    await this.paymentRepository.save(payment);
    await this.creditProviderWallet(payment);

    return { id: payment.id, status: payment.status };
  }

  async creditProviderWallet(payment: Payment) {
    if (!payment.booking) return;
    const booking = await this.bookingRepository.findOne({
      where: { id: payment.booking.id },
      relations: { provider: { user: true } },
    });
    if (!booking) return;

    const providerUserId = booking.provider.user.id;
    let wallet = await this.walletRepository.findOne({
      where: { user: { id: providerUserId } },
    });
    if (!wallet) {
      wallet = this.walletRepository.create({
        user: { id: providerUserId },
        balance: 0,
      });
      wallet = await this.walletRepository.save(wallet);
    }

    const providerAmount = Number(booking.providerAmount);
    wallet.balance = Number(wallet.balance) + providerAmount;
    await this.walletRepository.save(wallet);

    const tx = this.transactionRepository.create({
      wallet,
      type: 'credit',
      amount: providerAmount,
      reference: `booking_${booking.id}_payment_${payment.id}`,
      description: `Payout for booking #${booking.id}`,
      source: TransactionSource.BOOKING_PAYOUT,
      balanceAfter: Number(wallet.balance),
    });
    await this.transactionRepository.save(tx);

    const commissionAmount = Number(booking.commissionAmount);
    if (commissionAmount > 0) {
      const commissionTx = this.transactionRepository.create({
        wallet,
        type: 'debit',
        amount: commissionAmount,
        reference: `booking_${booking.id}_commission_${payment.id}`,
        description: `Commission owed for booking #${booking.id}`,
        source: TransactionSource.COMMISSION_OWED,
        balanceAfter: Number(wallet.balance),
      });
      await this.transactionRepository.save(commissionTx);

      this.softBlockService
        .checkAndBlockForProvider(providerUserId)
        .catch((err) =>
          this.logger.warn(
            `Soft-block check failed: ${(err as Error).message}`,
          ),
        );
    }
  }

  private async createCashOrder(
    booking: Booking,
    gatewayType: PaymentGatewayType,
  ) {
    const payment = this.paymentRepository.create({
      booking,
      method: PaymentMethod.CASH,
      status: PaymentStatus.PENDING,
      amount: Number(booking.totalAmount),
      gateway: gatewayType,
      gatewayOrderId: `cash_${booking.id}`,
    });
    await this.paymentRepository.save(payment);

    return {
      paymentId: payment.id,
      amount: payment.amount,
      method: 'cash',
      status: payment.status,
    };
  }
}
