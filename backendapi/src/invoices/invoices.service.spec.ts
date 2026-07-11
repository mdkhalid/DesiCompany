import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { ProviderService } from '../services/entities/provider-service.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
}

describe('InvoicesService', () => {
  let service: InvoicesService;
  let bookingRepo: MockRepo;
  let paymentRepo: MockRepo;

  beforeEach(async () => {
    bookingRepo = makeRepoMock();
    paymentRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(ProviderService), useValue: makeRepoMock() },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('generateInvoice', () => {
    it('should throw NotFoundException when booking not found', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(service.generateInvoice('b1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should generate invoice data for a valid booking', async () => {
      const mockBooking = {
        id: 'booking-12345678',
        scheduledDate: new Date('2026-07-15'),
        status: 'completed',
        description: 'Plumbing repair',
        totalAmount: 1000,
        providerAmount: 850,
        commissionAmount: 150,
        convenienceFee: 50,
        gstAmount: 180,
        charges: [{ chargeType: 'labor', description: 'Labor', amount: 500 }],
        customer: {
          firstName: 'John',
          lastName: 'Doe',
          address: '123 Main St',
          city: 'Mumbai',
          state: 'MH',
          pincode: '400001',
          user: { email: 'john@test.com', phone: '9876543210' },
        },
        provider: {
          firstName: 'Ravi',
          lastName: 'Kumar',
          user: { email: 'ravi@test.com', phone: '9876543211' },
        },
        providerService: { category: { nameEn: 'Plumbing' } },
      };
      bookingRepo.findOne.mockResolvedValue(mockBooking);
      paymentRepo.findOne.mockResolvedValue(null);

      const result = await service.generateInvoice('b1');

      expect(result.invoice.invoiceNumber).toMatch(/^INV-/);
      expect(result.customer.name).toBe('John Doe');
      expect(result.provider.name).toBe('Ravi Kumar');
      expect(result.financials.totalAmount).toBe(1000);
      expect(result.financials.commissionAmount).toBe(150);
      expect(result.payment).toBeNull();
    });

    it('should include payment data when payment exists', async () => {
      const mockBooking = {
        id: 'booking-12345678',
        scheduledDate: new Date(),
        status: 'completed',
        description: '',
        totalAmount: 500,
        providerAmount: 425,
        commissionAmount: 75,
        convenienceFee: 0,
        gstAmount: 0,
        charges: [],
        customer: { firstName: 'A', lastName: 'B', user: { email: null, phone: '1' } },
        provider: { firstName: 'C', lastName: 'D', user: { email: null, phone: '2' } },
        providerService: null,
      };
      bookingRepo.findOne.mockResolvedValue(mockBooking);
      paymentRepo.findOne.mockResolvedValue({
        id: 'pay1',
        method: 'razorpay',
        status: 'captured',
        amount: 500,
        gatewayOrderId: 'order_abc',
      });

      const result = await service.generateInvoice('b1');

      expect(result.payment).not.toBeNull();
      expect(result.payment!.method).toBe('razorpay');
    });
  });
});
