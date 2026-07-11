import { Test, TestingModule } from '@nestjs/testing';
import { SmsService } from './sms.service';
import { SMS_PROVIDER } from './sms.constants';

describe('SmsService', () => {
  let service: SmsService;
  let mockProvider: { send: jest.Mock };

  beforeEach(async () => {
    mockProvider = { send: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: SMS_PROVIDER, useValue: mockProvider },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('sendOtp', () => {
    it('should send OTP message via provider', async () => {
      await service.sendOtp('+919876543210', '123456');

      expect(mockProvider.send).toHaveBeenCalledTimes(1);
      expect(mockProvider.send).toHaveBeenCalledWith(
        '+919876543210',
        expect.stringContaining('123456'),
      );
      expect(mockProvider.send).toHaveBeenCalledWith(
        '+919876543210',
        expect.stringContaining('5 minutes'),
      );
    });

    it('should throw when provider fails', async () => {
      mockProvider.send.mockRejectedValue(new Error('SMS down'));

      await expect(
        service.sendOtp('+919876543210', '123456'),
      ).rejects.toThrow('SMS down');
    });
  });

  describe('send', () => {
    it('should send arbitrary message via provider', async () => {
      await service.send('+919876543210', 'Hello');

      expect(mockProvider.send).toHaveBeenCalledWith('+919876543210', 'Hello');
    });

    it('should throw when provider fails', async () => {
      mockProvider.send.mockRejectedValue(new Error('Timeout'));

      await expect(service.send('+919876543210', 'Hi')).rejects.toThrow(
        'Timeout',
      );
    });
  });
});
