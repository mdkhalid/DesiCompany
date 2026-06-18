import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookService } from './webhooks.service';
import { Payment } from './entities/payment.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { PaymentsService } from './payments.service';
import { PaymentGatewayType } from '../common/enums/payment-gateway-type.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';

describe('WebhookService', () => {
  let service: WebhookService;
  let paymentRepo: jest.Mocked<Repository<Payment>>;
  let webhookEventRepo: jest.Mocked<Repository<WebhookEvent>>;
  let factory: jest.Mocked<PaymentGatewayFactory>;
  let paymentsService: jest.Mocked<PaymentsService>;

  const mockGateway = {
    getName: jest.fn().mockReturnValue(PaymentGatewayType.RAZORPAY),
    verifyWebhookSignature: jest.fn(),
    parseWebhookEvent: jest.fn(),
    createOrder: jest.fn(),
    getStatus: jest.fn(),
    refund: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WebhookEvent),
          useValue: {
            findOne: jest.fn(),
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
        {
          provide: PaymentsService,
          useValue: {
            creditProviderWallet: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(WebhookService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    webhookEventRepo = module.get(getRepositoryToken(WebhookEvent));
    factory = module.get(PaymentGatewayFactory);
    paymentsService = module.get(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processWebhook', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured' }));

    it('rejects when signature verification fails for non-cash gateway', async () => {
      factory.getByType.mockResolvedValue(mockGateway);
      mockGateway.verifyWebhookSignature.mockReturnValue(false);

      const result = await service.processWebhook(
        PaymentGatewayType.RAZORPAY,
        rawBody,
        'bad_sig',
      );

      expect(result.received).toBe(false);
    });

    it('accepts cash webhooks without signature', async () => {
      const cashGateway = {
        ...mockGateway,
        getName: jest.fn().mockReturnValue(PaymentGatewayType.CASH),
        verifyWebhookSignature: jest.fn(),
        parseWebhookEvent: jest.fn().mockReturnValue({
          gateway: 'cash',
          eventId: 'evt_cash_1',
          status: 'success',
          gatewayOrderId: 'cash_order',
          rawPayload: {},
        }),
      };
      factory.getByType.mockResolvedValue(cashGateway);
      webhookEventRepo.findOne.mockResolvedValue(null);
      const mockEventRecord = {
        gateway: 'cash',
        eventId: 'evt_cash_1',
        payload: {},
        processedAt: null,
      };
      webhookEventRepo.create.mockReturnValue(mockEventRecord as any);

      const result = await service.processWebhook(
        PaymentGatewayType.CASH,
        rawBody,
        undefined,
      );

      expect(result.received).toBe(true);
    });

    it('returns received: true for duplicate events', async () => {
      factory.getByType.mockResolvedValue(mockGateway);
      mockGateway.verifyWebhookSignature.mockReturnValue(true);
      mockGateway.parseWebhookEvent.mockReturnValue({
        gateway: 'razorpay',
        eventId: 'evt_dup',
        status: 'success',
        rawPayload: {},
      });
      webhookEventRepo.findOne.mockResolvedValue({ id: 'existing' } as any);

      const result = await service.processWebhook(
        PaymentGatewayType.RAZORPAY,
        rawBody,
        'valid_sig',
      );

      expect(result.received).toBe(true);
      expect(result.eventId).toBe('evt_dup');
    });

    it('processes successful payment event and credits wallet', async () => {
      factory.getByType.mockResolvedValue(mockGateway);
      mockGateway.verifyWebhookSignature.mockReturnValue(true);
      mockGateway.parseWebhookEvent.mockReturnValue({
        gateway: 'razorpay',
        eventId: 'evt_new',
        status: 'success',
        gatewayOrderId: 'order_xyz',
        gatewayPaymentId: 'pay_abc',
        rawPayload: { event: 'payment.captured' },
      });
      webhookEventRepo.findOne.mockResolvedValue(null);
      const mockEvtRecord = {
        gateway: 'razorpay',
        eventId: 'evt_new',
        payload: {},
        processedAt: null,
      };
      webhookEventRepo.create.mockReturnValue(mockEvtRecord as any);
      paymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.PENDING,
        gatewayOrderId: 'order_xyz',
      } as any);

      const result = await service.processWebhook(
        PaymentGatewayType.RAZORPAY,
        rawBody,
        'valid_sig',
      );

      expect(result.received).toBe(true);
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.SUCCESS }),
      );
      expect(paymentsService.creditProviderWallet).toHaveBeenCalled();
    });
  });
});
