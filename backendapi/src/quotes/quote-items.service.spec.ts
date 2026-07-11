import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { QuoteItemsService } from './quote-items.service';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { CreateQuoteItemDto } from './dto/create-quote-item.dto';
import { UpdateQuoteItemDto } from './dto/update-quote-item.dto';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

describe('QuoteItemsService', () => {
  let service: QuoteItemsService;
  let quoteItemRepo: MockRepo;
  let quoteRepo: MockRepo;

  beforeEach(async () => {
    quoteItemRepo = makeRepoMock();
    quoteRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteItemsService,
        { provide: getRepositoryToken(QuoteItem), useValue: quoteItemRepo },
        { provide: getRepositoryToken(Quote), useValue: quoteRepo },
      ],
    }).compile();

    service = module.get<QuoteItemsService>(QuoteItemsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should throw NotFoundException when quote not found', async () => {
      quoteRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('q1', { description: 'Item', unitPrice: 100 }, 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user not quote owner', async () => {
      quoteRepo.findOne.mockResolvedValue({
        id: 'q1',
        provider: { user: { id: 'u-other' } },
      });
      await expect(
        service.create('q1', { description: 'Item', unitPrice: 100 }, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create item with default quantity 1', async () => {
      quoteRepo.findOne.mockResolvedValue({
        id: 'q1',
        provider: { user: { id: 'u1' } },
      });

      await service.create('q1', { description: 'Item', unitPrice: 100 }, 'u1');

      expect(quoteItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 1, totalPrice: 100 }),
      );
      expect(quoteItemRepo.save).toHaveBeenCalled();
    });

    it('should calculate totalPrice correctly', async () => {
      quoteRepo.findOne.mockResolvedValue({
        id: 'q1',
        provider: { user: { id: 'u1' } },
      });

      await service.create(
        'q1',
        { description: 'Item', unitPrice: 75, quantity: 3 },
        'u1',
      );

      expect(quoteItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalPrice: 225 }),
      );
    });
  });

  describe('findAll', () => {
    it('should return items for a quote', async () => {
      quoteItemRepo.find.mockResolvedValue([{ id: 'qi-1' }, { id: 'qi-2' }]);
      const result = await service.findAll('q1');
      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when item not found', async () => {
      quoteItemRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('qi-1', { unitPrice: 50 }, 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user not quote owner', async () => {
      quoteItemRepo.findOne.mockResolvedValue({
        id: 'qi-1',
        quote: { provider: { user: { id: 'u-other' } } },
      });
      await expect(
        service.update('qi-1', { unitPrice: 50 }, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update fields and recalculate totalPrice', async () => {
      const item = {
        id: 'qi-1',
        description: 'Old',
        quantity: 2,
        unitPrice: 50,
        totalPrice: 100,
        quote: { provider: { user: { id: 'u1' } } },
      };
      quoteItemRepo.findOne.mockResolvedValue(item);

      await service.update(
        'qi-1',
        { description: 'New', quantity: 4, unitPrice: 25 },
        'u1',
      );

      expect(item.description).toBe('New');
      expect(item.quantity).toBe(4);
      expect(item.unitPrice).toBe(25);
      expect(item.totalPrice).toBe(100); // 4 * 25
      expect(quoteItemRepo.save).toHaveBeenCalled();
    });

    it('should only update provided fields', async () => {
      const item = {
        id: 'qi-1',
        description: 'Keep',
        quantity: 2,
        unitPrice: 50,
        totalPrice: 100,
        quote: { provider: { user: { id: 'u1' } } },
      };
      quoteItemRepo.findOne.mockResolvedValue(item);

      await service.update('qi-1', { unitPrice: 75 }, 'u1');

      expect(item.description).toBe('Keep');
      expect(item.quantity).toBe(2);
      expect(item.unitPrice).toBe(75);
      expect(item.totalPrice).toBe(150); // 2 * 75
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when item not found', async () => {
      quoteItemRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('qi-1', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user not quote owner', async () => {
      quoteItemRepo.findOne.mockResolvedValue({
        id: 'qi-1',
        quote: { provider: { user: { id: 'u-other' } } },
      });
      await expect(service.remove('qi-1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('should remove item successfully', async () => {
      const item = {
        id: 'qi-1',
        quote: { provider: { user: { id: 'u1' } } },
      };
      quoteItemRepo.findOne.mockResolvedValue(item);

      await service.remove('qi-1', 'u1');

      expect(quoteItemRepo.remove).toHaveBeenCalledWith(item);
    });
  });
});
