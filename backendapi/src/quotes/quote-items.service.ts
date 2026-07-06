import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { CreateQuoteItemDto } from './dto/create-quote-item.dto';
import { UpdateQuoteItemDto } from './dto/update-quote-item.dto';

@Injectable()
export class QuoteItemsService {
  constructor(
    @InjectRepository(QuoteItem)
    private readonly quoteItemRepository: Repository<QuoteItem>,
    @InjectRepository(Quote)
    private readonly quoteRepository: Repository<Quote>,
  ) {}

  async create(
    quoteId: string,
    dto: CreateQuoteItemDto,
    providerUserId: string,
  ): Promise<QuoteItem> {
    const quote = await this.quoteRepository.findOne({
      where: { id: quoteId },
      relations: { provider: { user: true } },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.provider.user.id !== providerUserId)
      throw new BadRequestException(
        'You can only add items to your own quotes',
      );

    const quantity = dto.quantity ?? 1;
    const totalPrice = Math.round(quantity * dto.unitPrice * 100) / 100;

    const item = this.quoteItemRepository.create({
      quote: { id: quoteId },
      description: dto.description,
      quantity,
      unitPrice: dto.unitPrice,
      totalPrice,
    });

    return this.quoteItemRepository.save(item);
  }

  async findAll(quoteId: string): Promise<QuoteItem[]> {
    return this.quoteItemRepository.find({
      where: { quote: { id: quoteId } },
      order: { createdAt: 'ASC' },
    });
  }

  async update(
    itemId: string,
    dto: UpdateQuoteItemDto,
    providerUserId: string,
  ): Promise<QuoteItem> {
    const item = await this.quoteItemRepository.findOne({
      where: { id: itemId },
      relations: { quote: { provider: { user: true } } },
    });
    if (!item) throw new NotFoundException('Quote item not found');
    if (item.quote.provider.user.id !== providerUserId)
      throw new BadRequestException(
        'You can only update items on your own quotes',
      );

    if (dto.description !== undefined) item.description = dto.description;
    if (dto.quantity !== undefined) item.quantity = dto.quantity;
    if (dto.unitPrice !== undefined) item.unitPrice = dto.unitPrice;

    item.totalPrice =
      Math.round(Number(item.quantity) * Number(item.unitPrice) * 100) / 100;

    return this.quoteItemRepository.save(item);
  }

  async remove(itemId: string, providerUserId: string): Promise<void> {
    const item = await this.quoteItemRepository.findOne({
      where: { id: itemId },
      relations: { quote: { provider: { user: true } } },
    });
    if (!item) throw new NotFoundException('Quote item not found');
    if (item.quote.provider.user.id !== providerUserId)
      throw new BadRequestException(
        'You can only delete items from your own quotes',
      );

    await this.quoteItemRepository.remove(item);
  }
}
