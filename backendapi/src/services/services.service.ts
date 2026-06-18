import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceCategory } from './entities/service-category.entity';
import { ProviderService } from './entities/provider-service.entity';
import { ProviderAvailability } from './entities/provider-availability.entity';
import { Provider } from '../users/entities/provider.entity';
import { CommissionType } from '../common/enums/commission-type.enum';
import { CreateProviderServiceDto } from './dto/create-provider-service.dto';
import { UpdateProviderServiceDto } from './dto/update-provider-service.dto';
import { CreateProviderAvailabilityDto } from './dto/create-provider-availability.dto';
import { SearchProvidersDto } from './dto/search-providers.dto';

interface CategoryInput {
  nameEn?: string;
  nameHi?: string;
  icon?: string;
  commissionType?: CommissionType;
  commissionValue?: number;
  isActive?: boolean;
}

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(ServiceCategory)
    private readonly categoryRepository: Repository<ServiceCategory>,
    @InjectRepository(ProviderService)
    private readonly providerServiceRepository: Repository<ProviderService>,
    @InjectRepository(ProviderAvailability)
    private readonly availabilityRepository: Repository<ProviderAvailability>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async findAllCategories() {
    return this.categoryRepository.find({
      where: { isActive: true },
      order: { nameEn: 'ASC' },
    });
  }

  async createCategory(
    input: Required<Pick<CategoryInput, 'nameEn' | 'nameHi'>> & CategoryInput,
  ) {
    const category = this.categoryRepository.create({
      nameEn: input.nameEn,
      nameHi: input.nameHi,
      icon: input.icon,
      commissionType: input.commissionType,
      commissionValue: input.commissionValue,
    });
    return this.categoryRepository.save(category);
  }

  async updateCategory(id: string, input: CategoryInput) {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    Object.assign(category, input);
    return this.categoryRepository.save(category);
  }

  async deleteCategory(id: string) {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    category.isActive = false;
    return this.categoryRepository.save(category);
  }

  async findProviderServices(providerId: string) {
    return this.providerServiceRepository.find({
      where: { provider: { id: providerId }, isActive: true },
      relations: { category: true },
    });
  }

  async findProviderServiceById(id: string) {
    const service = await this.providerServiceRepository.findOne({
      where: { id },
      relations: { provider: true, category: true },
    });
    if (!service) {
      throw new NotFoundException('Provider service not found');
    }
    return service;
  }

  async createProviderService(dto: CreateProviderServiceDto) {
    const provider = await this.providerRepository.findOne({
      where: { id: dto.providerId },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const category = await this.categoryRepository.findOne({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (!dto.hourlyRate && !dto.dailyRate && !dto.fixedRate) {
      throw new BadRequestException('At least one pricing rate is required');
    }

    const service = this.providerServiceRepository.create({
      provider,
      category,
      hourlyRate: dto.hourlyRate,
      dailyRate: dto.dailyRate,
      fixedRate: dto.fixedRate,
    });
    return this.providerServiceRepository.save(service);
  }

  async updateProviderService(id: string, dto: UpdateProviderServiceDto) {
    const service = await this.providerServiceRepository.findOne({
      where: { id },
      relations: { category: true },
    });
    if (!service) {
      throw new NotFoundException('Provider service not found');
    }

    if (dto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
      service.category = category;
    }

    Object.assign(service, {
      hourlyRate: dto.hourlyRate,
      dailyRate: dto.dailyRate,
      fixedRate: dto.fixedRate,
      isActive: dto.isActive,
    });
    return this.providerServiceRepository.save(service);
  }

  async deleteProviderService(id: string) {
    const service = await this.providerServiceRepository.findOne({
      where: { id },
    });
    if (!service) {
      throw new NotFoundException('Provider service not found');
    }
    service.isActive = false;
    return this.providerServiceRepository.save(service);
  }

  async findProviderAvailability(providerId: string) {
    return this.availabilityRepository.find({
      where: { provider: { id: providerId } },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async createProviderAvailability(dto: CreateProviderAvailabilityDto) {
    const provider = await this.providerRepository.findOne({
      where: { id: dto.providerId },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const availability = this.availabilityRepository.create({
      provider,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
    });
    return this.availabilityRepository.save(availability);
  }

  async deleteProviderAvailability(id: string) {
    const availability = await this.availabilityRepository.findOne({
      where: { id },
    });
    if (!availability) {
      throw new NotFoundException('Availability slot not found');
    }
    await this.availabilityRepository.remove(availability);
  }

  async findAllVerifiedProviders() {
    return this.providerRepository.find({
      where: { isVerified: true },
      relations: {
        user: true,
        services: { category: true },
        availabilities: true,
      },
    });
  }

  async searchVerifiedProviders(dto: SearchProvidersDto) {
    const query = this.providerRepository
      .createQueryBuilder('provider')
      .leftJoinAndSelect('provider.user', 'user')
      .leftJoinAndSelect('provider.services', 'service')
      .leftJoinAndSelect('service.category', 'category')
      .leftJoinAndSelect('provider.availabilities', 'availability')
      .where('provider.isVerified = :isVerified', { isVerified: true });

    if (dto.categoryId) {
      query.andWhere('category.id = :categoryId', {
        categoryId: dto.categoryId,
      });
      query.andWhere('service.isActive = :isActive', { isActive: true });
    }

    if (dto.minRating !== undefined) {
      query.andWhere('provider.averageRating >= :minRating', {
        minRating: dto.minRating,
      });
    }

    if (
      dto.latitude !== undefined &&
      dto.longitude !== undefined &&
      dto.radiusKm
    ) {
      const radius = dto.radiusKm * 1000;
      const lat = dto.latitude;
      const lng = dto.longitude;
      query.addSelect(
        `6371000 * acos(
          cos(radians(:lat)) * cos(radians(provider.latitude)) *
          cos(radians(provider.longitude) - radians(:lng)) +
          sin(radians(:lat)) * sin(radians(provider.latitude))
        )`,
        'distance',
      );
      query.setParameters({ lat, lng });
      query.andWhere(
        `6371000 * acos(
          cos(radians(:lat)) * cos(radians(provider.latitude)) *
          cos(radians(provider.longitude) - radians(:lng)) +
          sin(radians(:lat)) * sin(radians(provider.latitude))
        ) <= :radius`,
        { radius },
      );
      query.orderBy('distance', 'ASC');
    }

    if (dto.availableNow) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const timeString = now.toTimeString().slice(0, 5);
      query.andWhere(
        'availability.dayOfWeek = :dayOfWeek AND availability.startTime <= :timeString AND availability.endTime >= :timeString',
        { dayOfWeek, timeString },
      );
    }

    return query.getMany();
  }
}
