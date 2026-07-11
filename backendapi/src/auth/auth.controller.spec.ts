import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from '../common/enums/user-role.enum';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    requestOtp: jest.Mock;
    register: jest.Mock;
    login: jest.Mock;
    verifyOtp: jest.Mock;
    refreshToken: jest.Mock;
    logout: jest.Mock;
    switchRole: jest.Mock;
    addRole: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      requestOtp: jest.fn().mockResolvedValue({ message: 'sent' }),
      register: jest.fn().mockResolvedValue({ user: {}, tokens: {} }),
      login: jest.fn().mockResolvedValue({ user: {}, tokens: {} }),
      verifyOtp: jest
        .fn()
        .mockResolvedValue({ user: {}, availableRoles: [], defaultRole: UserRole.CUSTOMER }),
      refreshToken: jest.fn().mockResolvedValue({ tokens: {} }),
      logout: jest.fn().mockResolvedValue({ message: 'ok' }),
      switchRole: jest.fn().mockResolvedValue({ user: {}, tokens: {} }),
      addRole: jest.fn().mockResolvedValue({ user: {}, tokens: {} }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate requestOtp', async () => {
    const result = await controller.requestOtp('9999999999');
    expect(authService.requestOtp).toHaveBeenCalledWith('9999999999');
    expect(result).toEqual({ message: 'sent' });
  });

  it('should delegate register with all fields', async () => {
    const result = await controller.register(
      '9876543210',
      '123456',
      UserRole.CUSTOMER,
      'A',
      'B',
      'a@b.com',
    );
    expect(authService.register).toHaveBeenCalledWith({
      phone: '9876543210',
      otp: '123456',
      role: UserRole.CUSTOMER,
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
    });
    expect(result).toEqual({ user: {}, tokens: {} });
  });

  it('should delegate login', async () => {
    await controller.login('9876543210', '123456', UserRole.CUSTOMER);
    expect(authService.login).toHaveBeenCalledWith({
      phone: '9876543210',
      otp: '123456',
      role: UserRole.CUSTOMER,
    });
  });

  it('should delegate verifyOtp', async () => {
    await controller.verifyOtp('9876543210', '123456');
    expect(authService.verifyOtp).toHaveBeenCalledWith({
      phone: '9876543210',
      otp: '123456',
    });
  });

  it('should delegate refreshToken', async () => {
    await controller.refresh('rt');
    expect(authService.refreshToken).toHaveBeenCalledWith('rt');
  });

  it('should delegate logout', async () => {
    await controller.logout('rt');
    expect(authService.logout).toHaveBeenCalledWith('rt');
  });

  it('should delegate switchRole with user id', async () => {
    await controller.switchRole({ user: { id: 'u-1' } }, UserRole.PROVIDER);
    expect(authService.switchRole).toHaveBeenCalledWith('u-1', UserRole.PROVIDER);
  });

  it('should delegate addRole with user id', async () => {
    await controller.addRole(
      { user: { id: 'u-1' } },
      UserRole.PROVIDER,
      'A',
      'B',
    );
    expect(authService.addRole).toHaveBeenCalledWith('u-1', UserRole.PROVIDER, 'A', 'B');
  });
});
