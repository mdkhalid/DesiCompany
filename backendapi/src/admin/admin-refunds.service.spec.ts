import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AdminRefundsService } from './admin-refunds.service';
import { Payment } from '../payments/entities/payment.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { PaymentGatewayFactory } from '../payments/gateways/payment-gateway.factory';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { PaymentGatewayType } from '../common/enums/payment-gateway-type.enum';

describe('AdminRefundsService', () => {
  let service: AdminRefundsService;
  let paymentRepo: jest.Mocked<Repository<Payment>>;
  let walletRepo: jest.Mocked<Repository<Wallet>>;
  let txRepo: jest.Mocked<Repository<Transaction>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminRefundsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
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
            getByType: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AdminRefundsService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    walletRepo = module.get(getRepositoryToken(Wallet));
    txRepo = module.get(getRepositoryToken(Transaction));
  });

  describe('processRefund', () => {
    it('throws NotFoundException when payment not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      await expect(service.processRefund({ paymentId: 'pay-1' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when payment not successful', async () => {
      paymentRepo.findOne.mockResolvedValue({ status: PaymentStatus.PENDING } as any);
      await expect(service.processRefund({ paymentId: 'pay-1' })).rejects.toThrow(BadRequestException);
    });

    it('processes refund and credits customer wallet', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.SUCCESS,
        amount: 500,
        gateway: PaymentGatewayType.RAZORPAY,
        transactionId: 'tx_gateway',
        booking: { customer: { user: { id: 'cust-user' } }, provider: { user: { id: 'prov-user' } } },
      } as any);
      walletRepo.findOne.mockResolvedValue(null);
      walletRepo.create.mockReturnValue({ balance: 0 } as any);
      txRepo.create.mockReturnValue({} as any);

      const result = await service.processRefund({ paymentId: 'pay-1' });

      expect(result.status).toBe('processed');
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.REFUNDED }),
      );
    });
  });
});
