import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { Setting } from './entities/setting.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
  };
}

describe('SettingsService', () => {
  let service: SettingsService;
  let settingRepo: MockRepo;

  beforeEach(async () => {
    settingRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: getRepositoryToken(Setting), useValue: settingRepo },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('get', () => {
    it('should return null when key not found', async () => {
      settingRepo.findOne.mockResolvedValue(null);

      const result = await service.get('some_key');
      expect(result).toBeNull();
    });

    it('should return value when key found', async () => {
      settingRepo.findOne.mockResolvedValue({ key: 'theme', value: 'dark' });

      const result = await service.get('theme');
      expect(result).toBe('dark');
    });
  });

  describe('getNumber', () => {
    it('should return default when key not found', async () => {
      settingRepo.findOne.mockResolvedValue(null);

      const result = await service.getNumber('count', 42);
      expect(result).toBe(42);
    });

    it('should parse numeric value', async () => {
      settingRepo.findOne.mockResolvedValue({ value: '99' });

      const result = await service.getNumber('count', 42);
      expect(result).toBe(99);
    });
  });

  describe('getBoolean', () => {
    it('should return default when key not found', async () => {
      settingRepo.findOne.mockResolvedValue(null);

      const result = await service.getBoolean('flag', true);
      expect(result).toBe(true);
    });

    it('should return true for "true"', async () => {
      settingRepo.findOne.mockResolvedValue({ value: 'true' });

      const result = await service.getBoolean('flag', false);
      expect(result).toBe(true);
    });

    it('should return false for "false"', async () => {
      settingRepo.findOne.mockResolvedValue({ value: 'false' });

      const result = await service.getBoolean('flag', true);
      expect(result).toBe(false);
    });
  });

  describe('set', () => {
    it('should create new setting', async () => {
      settingRepo.findOne.mockResolvedValue(null);

      await service.set('theme', 'dark', 'UI theme');

      expect(settingRepo.create).toHaveBeenCalledWith({
        key: 'theme',
        value: 'dark',
        description: 'UI theme',
      });
      expect(settingRepo.save).toHaveBeenCalled();
    });

    it('should update existing setting', async () => {
      const existing = { key: 'theme', value: 'light' };
      settingRepo.findOne.mockResolvedValue(existing);

      await service.set('theme', 'dark');

      expect(existing.value).toBe('dark');
      expect(settingRepo.save).toHaveBeenCalled();
    });
  });

  describe('getAll', () => {
    it('should return all settings', async () => {
      settingRepo.find.mockResolvedValue([{ key: 'a' }, { key: 'b' }]);

      const result = await service.getAll();
      expect(result).toHaveLength(2);
    });
  });
});
