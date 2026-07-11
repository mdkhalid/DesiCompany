import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { UserRole } from '../common/enums/user-role.enum';

describe('BookingsController', () => {
  let controller: BookingsController;
  let service: jest.Mocked<BookingsService>;

  const customerReq = { user: { id: 'user-1', role: UserRole.CUSTOMER } };
  const providerReq = { user: { id: 'user-2', role: UserRole.PROVIDER } };

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<BookingsService>> = {
      createByUser: jest.fn(),
      create: jest.fn(),
      findByCustomerUser: jest.fn(),
      findByCustomer: jest.fn(),
      findByProviderUser: jest.fn(),
      findByProvider: jest.fn(),
      findOne: jest.fn(),
      updateStatus: jest.fn(),
      reschedule: jest.fn(),
      proposeNewTime: jest.fn(),
      respondToProposal: jest.fn(),
      addCharge: jest.fn(),
      removeCharge: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [{ provide: BookingsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
    service = module.get(BookingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should delegate to createByUser when customerId is "me"', async () => {
      service.createByUser.mockResolvedValue({ id: 'b1' } as any);
      const dto = { customerId: 'me' } as any;
      const result = await controller.create(dto, customerReq);
      expect(service.createByUser).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual({ id: 'b1' });
    });

    it('should delegate to createByUser when customerId is missing', async () => {
      service.createByUser.mockResolvedValue({ id: 'b1' } as any);
      const dto = {} as any;
      await controller.create(dto, customerReq);
      expect(service.createByUser).toHaveBeenCalledWith('user-1', dto);
    });

    it('should delegate to create when explicit customerId provided', async () => {
      service.create.mockResolvedValue({ id: 'b2' } as any);
      const dto = { customerId: 'cust-1' } as any;
      const result = await controller.create(dto, customerReq);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'b2' });
    });
  });

  it('findMyCustomerBookings should delegate to findByCustomerUser', () => {
    controller.findMyCustomerBookings(customerReq);
    expect(service.findByCustomerUser).toHaveBeenCalledWith('user-1');
  });

  it('findByCustomer should delegate to findByCustomer', () => {
    controller.findByCustomer('cust-1');
    expect(service.findByCustomer).toHaveBeenCalledWith('cust-1');
  });

  it('findMyProviderBookings should delegate to findByProviderUser', () => {
    controller.findMyProviderBookings(providerReq);
    expect(service.findByProviderUser).toHaveBeenCalledWith('user-2');
  });

  it('findByProvider should delegate to findByProvider', () => {
    controller.findByProvider('prov-1');
    expect(service.findByProvider).toHaveBeenCalledWith('prov-1');
  });

  it('findOne should delegate to findOne', () => {
    controller.findOne('b1');
    expect(service.findOne).toHaveBeenCalledWith('b1');
  });

  it('updateStatus should delegate with user id and role', () => {
    const dto = { status: 'accepted' } as any;
    controller.updateStatus('b1', dto, providerReq);
    expect(service.updateStatus).toHaveBeenCalledWith(
      'b1',
      dto,
      'user-2',
      UserRole.PROVIDER,
    );
  });

  it('reschedule should delegate with user id and role', () => {
    const dto = { scheduledDate: '2026-07-01' } as any;
    controller.reschedule('b1', dto, customerReq);
    expect(service.reschedule).toHaveBeenCalledWith(
      'b1',
      dto,
      'user-1',
      UserRole.CUSTOMER,
    );
  });

  it('proposeNewTime should delegate with user id and role', () => {
    const dto = { proposedDate: '2026-07-01' } as any;
    controller.proposeNewTime('b1', dto, providerReq);
    expect(service.proposeNewTime).toHaveBeenCalledWith(
      'b1',
      dto,
      'user-2',
      UserRole.PROVIDER,
    );
  });

  it('respondToProposal should delegate with accept flag', () => {
    controller.respondToProposal('b1', true, customerReq);
    expect(service.respondToProposal).toHaveBeenCalledWith(
      'b1',
      true,
      'user-1',
      UserRole.CUSTOMER,
    );
  });

  it('addCharge should delegate with user id and role', () => {
    const dto = { bookingId: 'b1', amount: 10 } as any;
    controller.addCharge(dto, providerReq);
    expect(service.addCharge).toHaveBeenCalledWith(
      dto,
      'user-2',
      UserRole.PROVIDER,
    );
  });

  it('removeCharge should delegate with user id and role', () => {
    controller.removeCharge('charge-1', providerReq);
    expect(service.removeCharge).toHaveBeenCalledWith(
      'charge-1',
      'user-2',
      UserRole.PROVIDER,
    );
  });
});
