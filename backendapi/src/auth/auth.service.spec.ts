import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { RevokedToken } from './entities/revoked-token.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { SmsService } from '../sms/sms.service';
import { OtpStoreService } from '../common/redis-otp.service';
import { ProviderGraceService } from '../provider-grace/provider-grace.service';

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

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: MockRepo;
  let customerRepo: MockRepo;
  let providerRepo: MockRepo;
  let revokedTokenRepo: MockRepo;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let smsService: { sendOtp: jest.Mock };
  let otpStore: { set: jest.Mock; get: jest.Mock; delete: jest.Mock };
  let providerGraceService: { sendWelcome: jest.Mock };

  beforeEach(async () => {
    userRepo = makeRepoMock();
    customerRepo = makeRepoMock();
    providerRepo = makeRepoMock();
    revokedTokenRepo = makeRepoMock();
    jwtService = { sign: jest.fn().mockReturnValue('mock-token'), verify: jest.fn() };
    smsService = { sendOtp: jest.fn().mockResolvedValue(undefined) };
    otpStore = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    providerGraceService = { sendWelcome: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
        { provide: getRepositoryToken(RevokedToken), useValue: revokedTokenRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: SmsService, useValue: smsService },
        { provide: OtpStoreService, useValue: otpStore },
        { provide: ProviderGraceService, useValue: providerGraceService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('requestOtp', () => {
    it('should store OTP and return success message', async () => {
      process.env.OTP_MOCK = 'true';
      process.env.NODE_ENV = 'test';

      const result = await service.requestOtp('+919876543210');
      expect(result.message).toContain('+919876543210');
      expect(otpStore.set).toHaveBeenCalledWith('+919876543210', '123456');
    });

    it('should send SMS when not in mock mode', async () => {
      process.env.OTP_MOCK = 'false';

      await service.requestOtp('+919876543210');
      expect(smsService.sendOtp).toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should throw BadRequestException for admin registration', async () => {
      await expect(
        service.register({
          phone: '9876543210',
          otp: '123456',
          role: UserRole.ADMIN,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when OTP not found', async () => {
      otpStore.get.mockResolvedValue(null);

      await expect(
        service.register({
          phone: '9876543210',
          otp: '123456',
          role: UserRole.CUSTOMER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException for invalid OTP', async () => {
      otpStore.get.mockResolvedValue('999999');

      await expect(
        service.register({
          phone: '9876543210',
          otp: '123456',
          role: UserRole.CUSTOMER,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ConflictException when user already exists', async () => {
      otpStore.get.mockResolvedValue('123456');
      userRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          phone: '9876543210',
          otp: '123456',
          role: UserRole.CUSTOMER,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should register a new customer successfully', async () => {
      otpStore.get.mockResolvedValue('123456');
      const savedUser = { id: 'new-user', phone: '9876543210', role: UserRole.CUSTOMER };
      userRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(savedUser);
      userRepo.save.mockResolvedValue(savedUser);

      const result = await service.register({
        phone: '9876543210',
        otp: '123456',
        role: UserRole.CUSTOMER,
        firstName: 'John',
      });

      expect(result.tokens).toBeDefined();
      expect(result.user).toBeDefined();
      expect(customerRepo.create).toHaveBeenCalled();
      expect(otpStore.delete).toHaveBeenCalledWith('9876543210');
    });

    it('should register a new provider and send grace welcome', async () => {
      otpStore.get.mockResolvedValue('123456');
      const savedUser = { id: 'prov-user', phone: '9876543211', role: UserRole.PROVIDER };
      userRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(savedUser);
      userRepo.save.mockResolvedValue(savedUser);

      await service.register({
        phone: '9876543211',
        otp: '123456',
        role: UserRole.PROVIDER,
      });

      expect(providerRepo.create).toHaveBeenCalled();
      expect(providerGraceService.sendWelcome).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ phone: '9876543210', otp: '123456' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException when user is not active', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        status: UserStatus.SUSPENDED,
      });

      await expect(
        service.login({ phone: '9876543210', otp: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException when OTP not found', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        status: UserStatus.ACTIVE,
      });
      otpStore.get.mockResolvedValue(null);

      await expect(
        service.login({ phone: '9876543210', otp: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException for invalid OTP', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        status: UserStatus.ACTIVE,
      });
      otpStore.get.mockResolvedValue('999999');

      await expect(
        service.login({ phone: '9876543210', otp: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should login successfully and return tokens', async () => {
      const user = {
        id: 'u1',
        phone: '9876543210',
        status: UserStatus.ACTIVE,
        role: UserRole.CUSTOMER,
        roles: [UserRole.CUSTOMER],
        customer: { id: 'c1' },
        provider: null,
      };
      userRepo.findOne.mockResolvedValue(user);
      otpStore.get.mockResolvedValue('123456');

      const result = await service.login({ phone: '9876543210', otp: '123456' });

      expect(result.tokens).toBeDefined();
      expect(result.user).toBeDefined();
      expect(otpStore.delete).toHaveBeenCalled();
    });
  });

  describe('switchRole', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.switchRole('u1', UserRole.PROVIDER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user does not have the role', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        role: UserRole.CUSTOMER,
        roles: [UserRole.CUSTOMER],
        customer: { id: 'c1' },
        provider: null,
      });

      await expect(
        service.switchRole('u1', UserRole.PROVIDER),
      ).rejects.toThrow(BadRequestException);
    });

    it('should switch role successfully', async () => {
      const user = {
        id: 'u1',
        role: UserRole.CUSTOMER,
        roles: [UserRole.CUSTOMER, UserRole.PROVIDER],
        customer: { id: 'c1' },
        provider: { id: 'p1' },
      };
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.switchRole('u1', UserRole.PROVIDER);

      expect(user.role).toBe(UserRole.PROVIDER);
      expect(result.tokens).toBeDefined();
    });
  });

  describe('addRole', () => {
    it('should throw BadRequestException for non-customer/provider roles', async () => {
      await expect(
        service.addRole('u1', UserRole.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when user already has the role', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        roles: [UserRole.CUSTOMER],
        customer: { id: 'c1' },
        provider: null,
      });

      await expect(
        service.addRole('u1', UserRole.CUSTOMER),
      ).rejects.toThrow(ConflictException);
    });

    it('should add provider role to customer', async () => {
      const user = {
        id: 'u1',
        role: UserRole.CUSTOMER,
        roles: [UserRole.CUSTOMER],
        customer: { id: 'c1' },
        provider: null,
      };
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.addRole('u1', UserRole.PROVIDER);

      expect(user.roles).toContain(UserRole.PROVIDER);
      expect(providerRepo.create).toHaveBeenCalled();
      expect(result.tokens).toBeDefined();
    });
  });

  describe('logout', () => {
    it('should revoke token and return success', async () => {
      jwtService.verify.mockReturnValue({ sub: 'u1' });

      const result = await service.logout('refresh-token');
      expect(result.message).toBe('Logged out successfully');
      expect(revokedTokenRepo.save).toHaveBeenCalled();
    });

    it('should return success even with invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      const result = await service.logout('bad-token');
      expect(result.message).toBe('Logged out successfully');
    });
  });

  describe('refreshToken', () => {
    it('should throw UnauthorizedException when token is revoked', async () => {
      revokedTokenRepo.findOne.mockResolvedValue({ token: 'revoked' });

      await expect(service.refreshToken('revoked')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      revokedTokenRepo.findOne.mockResolvedValue(null);
      jwtService.verify.mockReturnValue({ sub: 'u1' });
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.refreshToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return new tokens when valid', async () => {
      revokedTokenRepo.findOne.mockResolvedValue(null);
      jwtService.verify.mockReturnValue({ sub: 'u1' });
      userRepo.findOne.mockResolvedValue({ id: 'u1', role: UserRole.CUSTOMER });

      const result = await service.refreshToken('valid-token');
      expect(result.tokens).toBeDefined();
    });
  });
});
