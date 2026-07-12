import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {IdempotencyService} from './idempotency.service';
import {IdempotencyKey} from './entities/idempotency-key.entity';
import {DataSource} from 'typeorm';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let repo: jest.Mocked<any>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((fn: any) =>
        Promise.resolve(fn({
          findOne: repo.findOne,
          save: repo.save,
          create: repo.create,
        })),
      ),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {provide: getRepositoryToken(IdempotencyKey), useValue: repo},
        {provide: DataSource, useValue: dataSource},
      ],
    }).compile();

    service = module.get(IdempotencyService);
  });

  it('should execute fn when key is new', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.save.mockResolvedValue({key: 'k1', result: {ok: true}});

    const result = await service.withLock('k1', 60, async () => ({ok: true}));

    expect(result).toEqual({ok: true});
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('should return cached result when key exists', async () => {
    repo.findOne.mockResolvedValue({key: 'k1', result: {ok: false}});

    const result = await service.withLock('k1', 60, async () => {
      throw new Error('should not run');
    });

    expect(result).toEqual({ok: false});
  });
});
