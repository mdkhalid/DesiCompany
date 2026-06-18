import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../payments/entities/payment.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { PaymentGatewayFactory } from '../payments/gateways/payment-gateway.factory';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { TransactionSource } from '../common/enums/transaction-source.enum';
import { AdminRefundDto } from '../payments/dto/admin-refund.dto';

@Injectable()
export class AdminRefundsService {
  private readonly logger = new Logger(AdminRefundsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly paymentGatewayFactory: PaymentGatewayFactory,
  ) {}

  async processRefund(dto: AdminRefundDto) {
    const payment = await this.paymentRepository.findOne({
      where: { id: dto.paymentId },
      relations: {
        booking: { customer: { user: true }, provider: { user: true } },
      },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Only successful payments can be refunded');
    }

    const refundAmount = dto.amount ?? Number(payment.amount);
    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be positive');
    }
    if (refundAmount > Number(payment.amount)) {
      throw new BadRequestException(
        'Refund amount cannot exceed payment amount',
      );
    }

    if (payment.gateway && payment.transactionId) {
      try {
        const gateway = await this.paymentGatewayFactory.getByType(
          payment.gateway,
        );
        const refundResult = await gateway.refund({
          gatewayPaymentId: payment.transactionId,
          amount: Math.round(refundAmount * 100),
          reason: dto.reason || 'admin initiated refund',
        });
        this.logger.log(`Gateway refund processed: ${refundResult.refundId}`);
      } catch (err) {
        this.logger.warn(
          `Gateway refund failed, proceeding with wallet credit: ${(err as Error).message}`,
        );
      }
    }

    payment.status = PaymentStatus.REFUNDED;
    await this.paymentRepository.save(payment);

    const customerUserId = payment.booking.customer.user.id;
    let wallet = await this.walletRepository.findOne({
      where: { user: { id: customerUserId } },
    });
    if (!wallet) {
      wallet = this.walletRepository.create({
        user: { id: customerUserId },
        balance: 0,
      });
    }
    wallet.balance = Number(wallet.balance) + refundAmount;
    await this.walletRepository.save(wallet);

    const tx = this.transactionRepository.create({
      wallet,
      type: 'credit',
      amount: refundAmount,
      reference: `refund_${payment.id}`,
      description: dto.reason || `Refund for payment ${payment.id}`,
      source: TransactionSource.REFUND,
      balanceAfter: Number(wallet.balance),
    });
    await this.transactionRepository.save(tx);

    return {
      refundId: tx.id,
      paymentId: payment.id,
      amount: refundAmount,
      status: 'processed',
    };
  }
}
