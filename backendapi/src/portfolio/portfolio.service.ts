import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioItem } from './entities/portfolio-item.entity';
import { Provider } from '../users/entities/provider.entity';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(PortfolioItem)
    private readonly portfolioRepository: Repository<PortfolioItem>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(ServiceCategory)
    private readonly categoryRepository: Repository<ServiceCategory>,
  ) {}

  async addItem(
    userId: string,
    title: string,
    imageUrl: string,
    description?: string,
    categoryId?: string,
  ) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) throw new NotFoundException('Provider profile not found');

    let category: ServiceCategory | null = null;
    if (categoryId) {
      category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });
    }

    const count = await this.portfolioRepository.count({
      where: { provider: { id: provider.id } },
    });

    const item = this.portfolioRepository.create({
      provider,
      title,
      description: description ?? undefined,
      imageUrl,
      category,
      displayOrder: count,
    });
    return this.portfolioRepository.save(item);
  }

  async getProviderPortfolio(providerId: string) {
    return this.portfolioRepository.find({
      where: { provider: { id: providerId } },
      relations: { category: true },
      order: { displayOrder: 'ASC' },
    });
  }

  async getByCategory(providerId: string, categoryId: string) {
    return this.portfolioRepository.find({
      where: { provider: { id: providerId }, category: { id: categoryId } },
      order: { displayOrder: 'ASC' },
    });
  }

  async deleteItem(userId: string, itemId: string, role: UserRole) {
    const item = await this.portfolioRepository.findOne({
      where: { id: itemId },
      relations: { provider: { user: true } },
    });
    if (!item) throw new NotFoundException('Portfolio item not found');

    if (role !== UserRole.ADMIN && item.provider.user.id !== userId) {
      throw new ForbiddenException("Cannot delete others' portfolio items");
    }
    await this.portfolioRepository.remove(item);
    return { message: 'Portfolio item deleted' };
  }
}
