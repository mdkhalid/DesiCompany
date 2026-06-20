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
import { ProviderDateOverride } from './entities/provider-date-override.entity';
import { Provider } from '../users/entities/provider.entity';
import { CommissionType } from '../common/enums/commission-type.enum';
import { CreateProviderServiceDto } from './dto/create-provider-service.dto';
import { UpdateProviderServiceDto } from './dto/update-provider-service.dto';
import { CreateProviderAvailabilityDto } from './dto/create-provider-availability.dto';
import { SearchProvidersDto } from './dto/search-providers.dto';
import { CreateDateOverrideDto } from './dto/date-override.dto';

interface CategoryInput {
  nameEn?: string;
  nameHi?: string;
  icon?: string;
  commissionType?: CommissionType;
  commissionValue?: number;
  isActive?: boolean;
  parentId?: string;
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
    @InjectRepository(ProviderDateOverride)
    private readonly dateOverrideRepository: Repository<ProviderDateOverride>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async findAllCategories() {
    return this.categoryRepository.find({
      where: { isActive: true },
      relations: { children: true, parent: true },
      order: { nameEn: 'ASC' },
    });
  }

  async findSubcategories(parentId: string) {
    return this.categoryRepository.find({
      where: { parent: { id: parentId }, isActive: true },
      order: { nameEn: 'ASC' },
    });
  }

  async createCategory(
    input: Required<Pick<CategoryInput, 'nameEn' | 'nameHi'>> & CategoryInput,
  ) {
    let parent: ServiceCategory | undefined;
    if (input.parentId) {
      const parentCategory = await this.categoryRepository.findOne({
        where: { id: input.parentId },
      });
      if (!parentCategory) {
        throw new NotFoundException('Parent category not found');
      }
      parent = parentCategory;
    }

    const category = this.categoryRepository.create({
      nameEn: input.nameEn,
      nameHi: input.nameHi,
      icon: input.icon,
      commissionType: input.commissionType,
      commissionValue: input.commissionValue,
      parent: parent || undefined,
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

  async createDateOverride(providerId: string, dto: CreateDateOverrideDto) {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    if (!dto.isAvailable && dto.startTime && dto.endTime) {
      throw new BadRequestException(
        'startTime and endTime should only be set when isAvailable is true',
      );
    }

    if (dto.isAvailable && dto.startTime && dto.endTime) {
      if (dto.startTime >= dto.endTime) {
        throw new BadRequestException('startTime must be before endTime');
      }
    }

    const existing = await this.dateOverrideRepository.findOne({
      where: { provider: { id: providerId }, overrideDate: dto.overrideDate },
    });
    if (existing) {
      throw new BadRequestException(
        'Date override already exists for this date. Use PATCH to update.',
      );
    }

    const override = this.dateOverrideRepository.create({
      provider,
      overrideDate: dto.overrideDate,
      isAvailable: dto.isAvailable,
      startTime: dto.startTime || null,
      endTime: dto.endTime || null,
      reason: dto.reason,
    });
    return this.dateOverrideRepository.save(override);
  }

  async updateDateOverride(
    providerId: string,
    overrideId: string,
    dto: Partial<CreateDateOverrideDto>,
  ) {
    const override = await this.dateOverrideRepository.findOne({
      where: { id: overrideId, provider: { id: providerId } },
    });
    if (!override) {
      throw new NotFoundException('Date override not found');
    }

    if (dto.isAvailable !== undefined) override.isAvailable = dto.isAvailable;
    if (dto.startTime !== undefined) override.startTime = dto.startTime || null;
    if (dto.endTime !== undefined) override.endTime = dto.endTime || null;
    if (dto.reason !== undefined) override.reason = dto.reason;

    return this.dateOverrideRepository.save(override);
  }

  async deleteDateOverride(providerId: string, overrideId: string) {
    const override = await this.dateOverrideRepository.findOne({
      where: { id: overrideId, provider: { id: providerId } },
    });
    if (!override) {
      throw new NotFoundException('Date override not found');
    }
    await this.dateOverrideRepository.remove(override);
    return { message: 'Date override deleted' };
  }

  async getDateOverrides(providerId: string) {
    return this.dateOverrideRepository.find({
      where: { provider: { id: providerId } },
      order: { overrideDate: 'ASC' },
    });
  }

  async getAvailableSlots(providerId: string, date: string) {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();

    const override = await this.dateOverrideRepository.findOne({
      where: { provider: { id: providerId }, overrideDate: date },
    });

    if (override && !override.isAvailable) {
      return {
        date,
        available: false,
        reason: override.reason || 'Provider not available on this date',
        slots: [],
      };
    }

    let startTime: string;
    let endTime: string;

    if (override && override.startTime && override.endTime) {
      startTime = override.startTime;
      endTime = override.endTime;
    } else {
      const availability = await this.availabilityRepository.findOne({
        where: { provider: { id: providerId }, dayOfWeek },
      });
      if (!availability) {
        return {
          date,
          available: false,
          reason: 'Provider not available on this day of week',
          slots: [],
        };
      }
      startTime = availability.startTime;
      endTime = availability.endTime;
    }

    const slots = this.generateTimeSlots(startTime, endTime, 60);

    return {
      date,
      available: true,
      slots,
    };
  }

  private generateTimeSlots(
    startTime: string,
    endTime: string,
    durationMinutes: number,
  ): string[] {
    const slots: string[] = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    while (currentMinutes + durationMinutes <= endMinutes) {
      const hour = Math.floor(currentMinutes / 60);
      const min = currentMinutes % 60;
      slots.push(
        `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
      );
      currentMinutes += durationMinutes;
    }

    return slots;
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
      // Get all subcategory IDs for hierarchical search
      const subcategoryIds = await this.getCategoryAndDescendantIds(dto.categoryId);

      query.andWhere('category.id IN (:...subcategoryIds)', {
        subcategoryIds,
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

    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      const priceConditions: string[] = [];
      if (dto.minPrice !== undefined) {
        priceConditions.push(
          '(service.hourlyRate >= :minPrice OR service.dailyRate >= :minPrice OR service.fixedRate >= :minPrice)',
        );
      }
      if (dto.maxPrice !== undefined) {
        priceConditions.push(
          '(service.hourlyRate <= :maxPrice OR service.dailyRate <= :maxPrice OR service.fixedRate <= :maxPrice)',
        );
      }
      if (priceConditions.length > 0) {
        query.andWhere(priceConditions.join(' AND '), {
          minPrice: dto.minPrice,
          maxPrice: dto.maxPrice,
        });
        query.andWhere('service.isActive = :serviceActive', {
          serviceActive: true,
        });
      }
    }

    return query.getMany();
  }

  private async getCategoryAndDescendantIds(
    categoryId: string,
  ): Promise<string[]> {
    const ids = [categoryId];
    const children = await this.categoryRepository.find({
      where: { parent: { id: categoryId }, isActive: true },
    });

    for (const child of children) {
      const descendantIds = await this.getCategoryAndDescendantIds(child.id);
      ids.push(...descendantIds);
    }

    return ids;
  }
}
