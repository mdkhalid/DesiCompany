import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { PaymentGatewayType } from '../common/enums/payment-gateway-type.enum';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { PaymentGateway } from './gateways/payment-gateway.interface';

interface CreateOrderResult {
  gatewayOrderId: string;
  keyId: string;
  amount: number;
  currency: string;
  paymentId: string;
}

interface CashOrderResult {
  paymentId: string;
  amount: number;
  method: string;
  status: PaymentStatus;
}

const mockGateway: jest.Mocked<PaymentGateway> = {
  getName: jest.fn().mockReturnValue(PaymentGatewayType.RAZORPAY),
  createOrder: jest.fn(),
  getStatus: jest.fn(),
  verifyWebhookSignature: jest.fn(),
  parseWebhookEvent: jest.fn(),
  refund: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepo: jest.Mocked<Repository<Payment>>;
  let bookingRepo: jest.Mocked<Repository<Booking>>;
  let walletRepo: jest.Mocked<Repository<Wallet>>;
  let txRepo: jest.Mocked<Repository<Transaction>>;
  let factory: jest.Mocked<PaymentGatewayFactory>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: PaymentGatewayFactory,
          useValue: {
            getDefault: jest.fn(),
            getByType: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PaymentsService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    bookingRepo = module.get(getRepositoryToken(Booking));
    walletRepo = module.get(getRepositoryToken(Wallet));
    txRepo = module.get(getRepositoryToken(Transaction));
    factory = module.get(PaymentGatewayFactory);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrderForBooking', () => {
    const userId = 'user-1';
    const bookingId = 'booking-1';
    const mockBooking = {
      id: bookingId,
      status: BookingStatus.COMPLETED,
      totalAmount: 500,
      customer: { user: { id: userId, phone: '9999999999' } },
      provider: { user: { id: 'provider-user' } },
    };

    it('throws NotFoundException when booking not found', async () => {
      bookingRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createOrderForBooking(bookingId, userId, UserRole.CUSTOMER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when wrong customer', async () => {
      bookingRepo.findOne.mockResolvedValue(mockBooking as unknown as Booking);
      await expect(
        service.createOrderForBooking(
          bookingId,
          'wrong-user',
          UserRole.CUSTOMER,
        ),
      ).rejects.toThrow('You can only pay for your own bookings');
    });

    it('throws BadRequestException when booking not completed', async () => {
      bookingRepo.findOne.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.WORKING,
      } as unknown as Booking);
      await expect(
        service.createOrderForBooking(bookingId, userId, UserRole.CUSTOMER),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when already paid', async () => {
      bookingRepo.findOne.mockResolvedValue(mockBooking as unknown as Booking);
      paymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.SUCCESS,
      } as unknown as Payment);
      await expect(
        service.createOrderForBooking(bookingId, userId, UserRole.CUSTOMER),
      ).rejects.toThrow(ConflictException);
    });

    it('creates online payment order via gateway', async () => {
      bookingRepo.findOne.mockResolvedValue(mockBooking as unknown as Booking);
      paymentRepo.findOne.mockResolvedValue(null);
      factory.getDefault.mockResolvedValue(mockGateway);
      mockGateway.createOrder.mockResolvedValue({
        gatewayOrderId: 'order_abc123',
        keyId: 'rzp_test_key',
        amount: 50000,
        currency: 'INR',
      });
      paymentRepo.create.mockReturnValue({
        id: 'pay-new',
      } as unknown as Payment);
      paymentRepo.save.mockResolvedValue({
        id: 'pay-new',
      } as unknown as Payment);

      const result = (await service.createOrderForBooking(
        bookingId,
        userId,
        UserRole.CUSTOMER,
      )) as CreateOrderResult;

      expect(mockGateway.createOrder).toHaveBeenCalledWith({
        amount: 50000,
        currency: 'INR',
        bookingId,
        customerPhone: '9999999999',
      });
      expect(result.gatewayOrderId).toBe('order_abc123');
      expect(result.paymentId).toBe('pay-new');
    });

    it('creates cash order when default gateway is cash', async () => {
      const cashGateway: jest.Mocked<PaymentGateway> = {
        getName: jest.fn().mockReturnValue(PaymentGatewayType.CASH),
        createOrder: jest.fn(),
        getStatus: jest.fn(),
        verifyWebhookSignature: jest.fn(),
        parseWebhookEvent: jest.fn(),
        refund: jest.fn(),
      };
      bookingRepo.findOne.mockResolvedValue(mockBooking as unknown as Booking);
      paymentRepo.findOne.mockResolvedValue(null);
      factory.getDefault.mockResolvedValue(cashGateway);
      paymentRepo.create.mockReturnValue({
        id: 'pay-cash',
      } as unknown as Payment);

      const result = (await service.createOrderForBooking(
        bookingId,
        userId,
        UserRole.CUSTOMER,
      )) as CashOrderResult;

      expect(result.method).toBe('cash');
      expect(result.paymentId).toBe('pay-cash');
    });
  });

  describe('getPaymentStatus', () => {
    const userId = 'user-1';
    const paymentId = 'pay-1';

    it('throws NotFoundException when payment not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getPaymentStatus(paymentId, userId, UserRole.CUSTOMER),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns cached status when payment is not pending', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: paymentId,
        status: PaymentStatus.SUCCESS,
        amount: 500,
        method: PaymentMethod.CASH,
        gateway: PaymentGatewayType.CASH,
        booking: {
          customer: { user: { id: userId } },
          provider: { user: { id: 'p-user' } },
        },
      } as unknown as Payment);

      const result = await service.getPaymentStatus(
        paymentId,
        userId,
        UserRole.CUSTOMER,
      );
      expect(result.status).toBe(PaymentStatus.SUCCESS);
    });

    it('polls gateway for pending payments and updates on success', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: paymentId,
        status: PaymentStatus.PENDING,
        amount: 500,
        method: PaymentMethod.ONLINE,
        gateway: PaymentGatewayType.RAZORPAY,
        gatewayOrderId: 'order_abc',
        booking: {
          customer: { user: { id: userId } },
          provider: { user: { id: 'p-user' } },
        },
      } as unknown as Payment);
      factory.getByType.mockResolvedValue(mockGateway);
      mockGateway.getStatus.mockResolvedValue({
        status: 'success',
        gatewayPaymentId: 'pay_xyz',
        gatewayOrderId: 'order_abc',
        amount: 50000,
      });

      const result = await service.getPaymentStatus(
        paymentId,
        userId,
        UserRole.CUSTOMER,
      );

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.SUCCESS }),
      );
      expect(result.status).toBe(PaymentStatus.SUCCESS);
    });
  });

  describe('payCash', () => {
    it('creates cash payment record', async () => {
      const userId = 'user-1';
      bookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.COMPLETED,
        totalAmount: 500,
        customer: { user: { id: userId } },
      } as unknown as Booking);
      paymentRepo.findOne.mockResolvedValue(null);
      paymentRepo.create.mockReturnValue({
        id: 'pay-cash',
      } as unknown as Payment);

      const result = await service.payCash(
        'booking-1',
        userId,
        UserRole.CUSTOMER,
      );

      expect(result.method).toBe('cash');
      expect(result.paymentId).toBe('pay-cash');
    });
  });

  describe('markCashReceived', () => {
    it('marks cash payment as success and credits wallet', async () => {
      const providerUserId = 'prov-user';
      bookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        provider: { user: { id: providerUserId } },
        providerAmount: 400,
      } as unknown as Booking);
      paymentRepo.findOne.mockResolvedValue({
        id: 'pay-cash',
        status: PaymentStatus.PENDING,
        method: PaymentMethod.CASH,
        booking: { id: 'booking-1' },
      } as unknown as Payment);
      walletRepo.findOne.mockResolvedValue(null);
      walletRepo.create.mockReturnValue({
        balance: 0,
        user: { id: providerUserId },
      } as unknown as Wallet);
      walletRepo.save.mockResolvedValue({} as unknown as Wallet);
      txRepo.create.mockReturnValue({} as unknown as Transaction);

      const result = await service.markCashReceived(
        'booking-1',
        providerUserId,
        UserRole.PROVIDER,
      );

      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(walletRepo.save).toHaveBeenCalled();
    });
  });
});
