import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {AccountsService} from './accounts.service';
import {Account} from './entities/account.entity';
import {LedgerEntry} from './entities/ledger-entry.entity';
import {LedgerEntryType} from './entities/ledger-entry.entity';
import {DataSource} from 'typeorm';
import {AccountType, AccountCategory} from './entities/account.entity';

describe('AccountsService', () => {
  let service: AccountsService;
  let accountRepo: jest.Mocked<any>;
  let ledgerRepo: jest.Mocked<any>;
  let dataSource: jest.Mocked<DataSource>;

  const mockAccount = {
    id: 'a1',
    code: 'platform-revenue',
    name: 'Platform Revenue',
    type: AccountType.REVENUE,
    category: AccountCategory.PLATFORM_REVENUE,
    isActive: true,
    balance: 0,
  };

  beforeEach(async () => {
    accountRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };
    ledgerRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((fn) => fn({
        findOne: accountRepo.findOne,
        save: jest.fn(),
        create: ledgerRepo.create,
      })),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {provide: getRepositoryToken(Account), useValue: accountRepo},
        {provide: getRepositoryToken(LedgerEntry), useValue: ledgerRepo},
        {provide: DataSource, useValue: dataSource},
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('ensureDefaults should create missing accounts', async () => {
    accountRepo.findOne.mockResolvedValue(null);
    accountRepo.create.mockImplementation((d: any) => d);
    accountRepo.save.mockResolvedValue({id: 'a1', code: 'platform-revenue'} as any);

    await service.ensureDefaults();

    expect(accountRepo.save).toHaveBeenCalledTimes(10);
  });

  it('postEntry should create ledger entry and update balance', async () => {
    const mockManager = {
      findOne: jest.fn().mockResolvedValue(mockAccount),
      save: jest.fn(),
      create: jest.fn().mockImplementation((entity, dto: any) => dto),
    };
    (dataSource.transaction as jest.Mock).mockImplementation((fn: any) =>
      Promise.resolve(fn(mockManager)),
    );

    const result = await service.postEntry({
      accountCode: 'platform-revenue',
      type: LedgerEntryType.CREDIT,
      amount: 100,
      description: 'Test',
    });

    expect(result).toBeDefined();
    expect(mockManager.save).toHaveBeenCalledTimes(2);
  });

  it('postEntry should throw for missing account', async () => {
    const mockManager = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
      create: jest.fn(),
    };
    (dataSource.transaction as jest.Mock).mockImplementation((fn: any) =>
      Promise.resolve(fn(mockManager)),
    );

    await expect(
      service.postEntry({
        accountCode: 'missing',
        type: LedgerEntryType.CREDIT,
        amount: 100,
      }),
    ).rejects.toThrow('Account not found: missing');
  });
});
