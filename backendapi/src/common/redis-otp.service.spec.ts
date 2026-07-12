import { OtpStoreService } from './redis-otp.service';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    setex: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  }));
});

const mockSettings = () => ({
  isRedisRequired: jest.fn().mockResolvedValue(false),
});

describe('OtpStoreService', () => {
  let service: OtpStoreService;

  beforeEach(() => {
    service = new OtpStoreService(mockSettings() as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('should fall back to in-memory when Redis is unavailable', () => {
    expect(service.isConnected()).toBe(false);
  });

  it('should store and retrieve OTP', async () => {
    await service.set('+919876543210', '123456');
    const code = await service.get('+919876543210');
    expect(code).toBe('123456');
  });

  it('should return null for non-existent phone', async () => {
    const code = await service.get('+910000000000');
    expect(code).toBeNull();
  });

  it('should delete OTP', async () => {
    await service.set('+919876543210', '123456');
    await service.delete('+919876543210');
    const code = await service.get('+919876543210');
    expect(code).toBeNull();
  });

  it('should return null for expired OTP', async () => {
    await service.set('+919876543210', '123456');
    // Expire the OTP by manipulating the fallback map directly
    const fallbackMap = (service as any).fallbackMap as Map<
      string,
      { code: string; expiresAt: Date }
    >;
    const record = fallbackMap.get('+919876543210')!;
    record.expiresAt = new Date(Date.now() - 1000);

    const code = await service.get('+919876543210');
    expect(code).toBeNull();
    expect(fallbackMap.has('+919876543210')).toBe(false);
  });
});
