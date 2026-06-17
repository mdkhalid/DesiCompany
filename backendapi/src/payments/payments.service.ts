import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
import { ForbiddenException } from '@nestjs/common';

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
    private readonly paymentGatewayFactory: PaymentGatewayFactory,
    private readonly dataSource: DataSource,
  ) {}

  async createOrderForBooking(bookingId: string, userId: string, role: UserRole) {
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
      relations: { booking: { customer: { user: true }, provider: { user: true } } },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (
      role !== UserRole.ADMIN &&
      payment.booking.customer.user.id !== userId &&
      payment.booking.provider.user.id !== userId
    ) {
      throw new ForbiddenException('Access denied');
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
      const gateway = await this.paymentGatewayFactory.getByType(payment.gateway);
      const gatewayStatus = await gateway.getStatus(payment.gatewayOrderId);

      if (gatewayStatus.status === 'success' && payment.status === PaymentStatus.PENDING) {
        payment.status = PaymentStatus.SUCCESS;
        payment.gatewayResponse = JSON.stringify(gatewayStatus);
        await this.paymentRepository.save(payment);
        await this.creditProviderWallet(payment);
      } else if (gatewayStatus.status === 'failed' && payment.status === PaymentStatus.PENDING) {
        payment.status = PaymentStatus.FAILED;
        payment.gatewayResponse = JSON.stringify(gatewayStatus);
        await this.paymentRepository.save(payment);
      }
    } catch (err) {
      this.logger.warn(`Failed to poll gateway for payment ${paymentId}: ${(err as Error).message}`);
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
      throw new ForbiddenException('You can only mark cash received for your own bookings');
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
        user: { id: providerUserId } as any,
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
  }

  private async createCashOrder(booking: Booking, gatewayType: PaymentGatewayType) {
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
