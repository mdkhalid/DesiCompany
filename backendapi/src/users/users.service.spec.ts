import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Customer } from './entities/customer.entity';
import { Provider } from './entities/provider.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  delete: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    delete: jest.fn(),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: MockRepo;
  let customerRepo: MockRepo;
  let providerRepo: MockRepo;

  beforeEach(async () => {
    userRepo = makeRepoMock();
    customerRepo = makeRepoMock();
    providerRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getProfile', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      providerRepo.findOne.mockResolvedValue(null);

      await expect(service.getProfile('u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return user profile with provider and customer IDs', async () => {
      const mockUser = {
        id: 'u1',
        phone: '9876543210',
        role: UserRole.CUSTOMER,
        roles: [UserRole.CUSTOMER],
        customer: { id: 'c1', firstName: 'John' },
        provider: null,
      };
      userRepo.findOne.mockResolvedValue(mockUser);
      providerRepo.findOne.mockResolvedValue({ id: 'p1', user: mockUser });
      customerRepo.findOne.mockResolvedValue({ id: 'c1' });

      const result = await service.getProfile('u1');
      expect(result.id).toBe('u1');
      expect(result.customerId).toBe('c1');
      expect(result.providerId).toBe('p1');
    });
  });

  describe('updateProfile', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('u1', { firstName: 'Jane' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user email and save', async () => {
      const mockUser = {
        id: 'u1',
        email: 'old@test.com',
        customer: null,
        provider: null,
      };
      userRepo.findOne.mockResolvedValue(mockUser);
      providerRepo.findOne.mockResolvedValue(null);
      customerRepo.findOne.mockResolvedValue(null);

      await service.updateProfile('u1', { email: 'new@test.com' });

      expect(mockUser.email).toBe('new@test.com');
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should update customer fields when customer exists', async () => {
      const mockCustomer = { firstName: 'Old', lastName: 'Name', save: jest.fn() };
      const mockUser = {
        id: 'u1',
        customer: mockCustomer,
        provider: null,
      };
      userRepo.findOne.mockResolvedValue(mockUser);
      providerRepo.findOne.mockResolvedValue(null);
      customerRepo.findOne.mockResolvedValue(null);

      await service.updateProfile('u1', { firstName: 'New' });

      expect(mockCustomer.firstName).toBe('New');
      expect(customerRepo.save).toHaveBeenCalledWith(mockCustomer);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const users = [{ id: 'u1' }, { id: 'u2' }];
      userRepo.find.mockResolvedValue(users);

      const result = await service.findAll();
      expect(result).toEqual(users);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      providerRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('u1')).rejects.toThrow(NotFoundException);
    });

    it('should return user when found', async () => {
      const user = { id: 'u1', phone: '9876543210' };
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findOne('u1');
      expect(result).toEqual(user);
    });
  });

  describe('updateStatus', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('u1', UserStatus.SUSPENDED),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user status', async () => {
      const mockUser = { id: 'u1', status: UserStatus.ACTIVE };
      userRepo.findOne.mockResolvedValue(mockUser);

      await service.updateStatus('u1', UserStatus.SUSPENDED);

      expect(mockUser.status).toBe(UserStatus.SUSPENDED);
      expect(userRepo.save).toHaveBeenCalledWith(mockUser);
    });
  });
});
