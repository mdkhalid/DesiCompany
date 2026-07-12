import { Test, TestingModule } from '@nestjs/testing';
import { FraudService } from './fraud.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { SettingsService } from '../settings/settings.service';
import { NotFoundException } from '@nestjs/common';

describe('FraudService', () => {
  let service: FraudService;
  let userRepo: jest.Mocked<any>;
  let settingsService: jest.Mocked<SettingsService>;

  beforeEach(async () => {
    userRepo = {
      createQueryBuilder: jest.fn(),
    };
    settingsService = {
      get: jest.fn().mockResolvedValue(null),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get(FraudService);
  });

  it('checkOtpAbuse should pass for first attempt', async () => {
    await expect(service.checkOtpAbuse('+919876543210')).resolves.toBeUndefined();
  });

  it('checkOtpAbuse should pass for repeated attempts under 15 minutes', async () => {
    await service.checkOtpAbuse('+919876543210');
    await service.checkOtpAbuse('+919876543210');
    await service.checkOtpAbuse('+919876543210');
    await expect(service.checkOtpAbuse('+919876543210')).resolves.toBeUndefined();
  });

  it('checkPayoutVelocity should allow first payout', async () => {
    await expect(
      service.checkPayoutVelocity('user-1'),
    ).resolves.toBeUndefined();
  });

  it('checkFakeBookingPatterns should not throw', async () => {
    userRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ cnt: '0' }),
    });

    await expect(
      service.checkFakeBookingPatterns('customer-1', 'provider-1'),
    ).resolves.toBeUndefined();
  });
});
