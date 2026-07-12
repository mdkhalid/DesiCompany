import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CityService } from './city.service';
import { City } from './entities/city.entity';

describe('CityService', () => {
  let service: CityService;
  let repo: jest.Mocked<any>;

  const mockCity = {
    id: 'c1',
    nameEn: 'Delhi',
    nameHi: 'दिल्ली',
    state: 'Delhi',
    isActive: true,
    sortOrder: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CityService,
        {
          provide: getRepositoryToken(City),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CityService);
    repo = module.get(getRepositoryToken(City));
  });

  it('create should persist trimmed city', async () => {
    repo.create.mockReturnValue(mockCity);
    repo.save.mockResolvedValue(mockCity);

    const result = await service.create({
      nameEn: '  Mumbai  ',
      nameHi: 'मुंबई',
      state: 'Maharashtra',
      sortOrder: 2,
    });

    expect(repo.create).toHaveBeenCalledWith({
      nameEn: 'Mumbai',
      nameHi: 'मुंबई',
      state: 'Maharashtra',
      isActive: true,
      sortOrder: 2,
    } as any);
    expect(result).toEqual(mockCity);
  });

  it('findOne should throw NotFound for unknown id', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow('City not found');
  });

  it('remove should find then delete', async () => {
    repo.findOne.mockResolvedValue(mockCity);
    repo.remove.mockResolvedValue(mockCity);

    const result = await service.remove('c1');

    expect(result).toEqual(mockCity);
  });
});
