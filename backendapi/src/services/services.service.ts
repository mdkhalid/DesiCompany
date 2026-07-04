import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan, LessThan, Raw } from 'typeorm';
import { ServiceCategory } from './entities/service-category.entity';
import { ProviderService } from './entities/provider-service.entity';
import { ProviderAvailability } from './entities/provider-availability.entity';
import { ProviderDateOverride } from './entities/provider-date-override.entity';
import { ProviderBusySlot } from './entities/provider-busy-slot.entity';
import { Provider } from '../users/entities/provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { CommissionType } from '../common/enums/commission-type.enum';
import { CreateProviderServiceDto } from './dto/create-provider-service.dto';
import { UpdateProviderServiceDto } from './dto/update-provider-service.dto';
import { CreateProviderAvailabilityDto } from './dto/create-provider-availability.dto';
import { SearchProvidersDto } from './dto/search-providers.dto';
import { CreateDateOverrideDto } from './dto/date-override.dto';
import { SettingsService } from '../settings/settings.service';

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
    @InjectRepository(ProviderBusySlot)
    private readonly busySlotRepository: Repository<ProviderBusySlot>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly settingsService: SettingsService,
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

  async setWeeklySchedule(
    providerId: string,
    slots: { dayOfWeek: number; startTime: string; endTime: string }[],
  ) {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    for (const slot of slots) {
      if (slot.startTime >= slot.endTime) {
        throw new BadRequestException(
          `startTime must be before endTime for day ${slot.dayOfWeek}`,
        );
      }
    }

    await this.availabilityRepository.delete({
      provider: { id: providerId },
    });

    if (slots.length === 0) return [];

    const entities = slots.map((slot) =>
      this.availabilityRepository.create({
        provider,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
      }),
    );

    return this.availabilityRepository.save(entities);
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

    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();
    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);

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
      const availability = await this.availabilityRepository.find({
        where: { provider: { id: providerId }, dayOfWeek },
        order: { startTime: 'ASC' },
      });
      if (availability.length === 0) {
        return {
          date,
          available: false,
          reason: 'Provider not available on this day of week',
          slots: [],
        };
      }

      const allSlots: { start: string; end: string; booked: boolean }[] = [];
      const activeStatuses = [
        BookingStatus.REQUESTED,
        BookingStatus.ACCEPTED,
        BookingStatus.ON_THE_WAY,
        BookingStatus.WORKING,
      ];

      const existingBookings = await this.bookingRepository.find({
        where: {
          provider: { id: providerId },
          scheduledDate: MoreThan(dateObj),
          status: In(activeStatuses),
        },
        select: { id: true, scheduledDate: true, estimatedHours: true },
      });

      const bookedRanges = existingBookings
        .filter((b) => {
          const bDate = new Date(b.scheduledDate);
          return bDate >= dateObj && bDate < nextDay;
        })
        .map((b) => {
          const bDate = new Date(b.scheduledDate);
          const startMinutes = bDate.getHours() * 60 + bDate.getMinutes();
          const duration = (b.estimatedHours || 1) * 60;
          return { startMin: startMinutes, endMin: startMinutes + duration };
        });

      // Busy slots (provider-marked unavailable times for this date)
      const busySlots = await this.busySlotRepository.find({
        where: { provider: { id: providerId }, busyDate: date },
      });

      const isOverlapping = (slotStart: number, slotEnd: number) =>
        bookedRanges.some((b) => slotStart < b.endMin && slotEnd > b.startMin) ||
        busySlots.some((bs) => {
          const [bsH, bsM] = bs.startTime.split(':').map(Number);
          const [beH, beM] = bs.endTime.split(':').map(Number);
          const busyStart = bsH * 60 + bsM;
          const busyEnd = beH * 60 + beM;
          return slotStart < busyEnd && slotEnd > busyStart;
        });

      for (const avail of availability) {
        const slots = this.generateTimeSlotRanges(
          avail.startTime,
          avail.endTime,
          60,
        );
        for (const slot of slots) {
          allSlots.push({
            start: slot.start,
            end: slot.end,
            booked: isOverlapping(slot.startMin, slot.endMin),
          });
        }
      }

      return {
        date,
        available: allSlots.length > 0,
        slots: allSlots,
      };
    }

    const slots = this.generateTimeSlotRanges(startTime, endTime, 60).map(
      (s) => ({ start: s.start, end: s.end, booked: false }),
    );

    return {
      date,
      available: slots.length > 0,
      slots,
    };
  }

  private generateTimeSlotRanges(
    startTime: string,
    endTime: string,
    durationMinutes: number,
  ): { start: string; end: string; startMin: number; endMin: number }[] {
    const slots: {
      start: string;
      end: string;
      startMin: number;
      endMin: number;
    }[] = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    while (currentMinutes + durationMinutes <= endMinutes) {
      const slotStart = currentMinutes;
      const slotEnd = currentMinutes + durationMinutes;
      const sHour = Math.floor(slotStart / 60);
      const sMin = slotStart % 60;
      const eHour = Math.floor(slotEnd / 60);
      const eMin = slotEnd % 60;
      slots.push({
        start: `${sHour.toString().padStart(2, '0')}:${sMin.toString().padStart(2, '0')}`,
        end: `${eHour.toString().padStart(2, '0')}:${eMin.toString().padStart(2, '0')}`,
        startMin: slotStart,
        endMin: slotEnd,
      });
      currentMinutes += durationMinutes;
    }

    return slots;
  }

  async findAllVerifiedProviders() {
    const gracePeriodDays = await this.settingsService.getProviderGracePeriodDays();
    const gracePeriodEnabled = await this.settingsService.isProviderGracePeriodEnabled();
    const gracePeriodDate = new Date();
    gracePeriodDate.setDate(gracePeriodDate.getDate() - gracePeriodDays);

    const query = this.providerRepository
      .createQueryBuilder('provider')
      .leftJoinAndSelect('provider.user', 'user')
      .leftJoinAndSelect('provider.services', 'service')
      .leftJoinAndSelect('service.category', 'category')
      .leftJoinAndSelect('provider.availabilities', 'availability')
      .where('(provider.isVerified = :isVerified OR (:graceEnabled = true AND provider.providerCreatedAt > :gracePeriodDate))', { 
        isVerified: true, 
        graceEnabled: gracePeriodEnabled,
        gracePeriodDate 
      })
      .andWhere('provider.latitude IS NOT NULL')
      .andWhere('provider.longitude IS NOT NULL');

    return query.getMany();
  }

  async searchVerifiedProviders(dto: SearchProvidersDto) {
    const gracePeriodDays = await this.settingsService.getProviderGracePeriodDays();
    const gracePeriodEnabled = await this.settingsService.isProviderGracePeriodEnabled();
    const gracePeriodDate = new Date();
    gracePeriodDate.setDate(gracePeriodDate.getDate() - gracePeriodDays);

    const query = this.providerRepository
      .createQueryBuilder('provider')
      .leftJoinAndSelect('provider.user', 'user')
      .leftJoinAndSelect('provider.services', 'service')
      .leftJoinAndSelect('service.category', 'category')
      .leftJoinAndSelect('provider.availabilities', 'availability')
      .where('(provider.isVerified = :isVerified OR (:graceEnabled = true AND provider.providerCreatedAt > :gracePeriodDate))', { 
        isVerified: true, 
        graceEnabled: gracePeriodEnabled,
        gracePeriodDate 
      });

    if (dto.categoryId) {
      // Get all subcategory IDs for hierarchical search
      const subcategoryIds = await this.getCategoryAndDescendantIds(
        dto.categoryId,
      );

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
      const lat = dto.latitude;
      const lng = dto.longitude;
      // Only include providers with valid location data
      query.andWhere('provider.latitude IS NOT NULL');
      query.andWhere('provider.longitude IS NOT NULL');
      
      // Haversine distance in meters
      const haversine = `6371000 * acos(
        cos(radians(:lat)) * cos(radians(provider.latitude)) *
        cos(radians(provider.longitude) - radians(:lng)) +
        sin(radians(:lat)) * sin(radians(provider.latitude))
      )`;
      query.addSelect(`(${haversine})`, 'distance');
      query.setParameters({ lat, lng });
      // Effective radius = smaller of customer's search radius and provider's service radius
      query.andWhere(
        `(${haversine}) / 1000 <= LEAST(:radiusKm, COALESCE(provider.serviceRadiusKm, :radiusKm))`,
        { radiusKm: dto.radiusKm },
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

  // ─── Busy Slot Management ────────────────────────────────────

  async getBusySlots(
    providerId: string,
    date?: string,
  ): Promise<ProviderBusySlot[]> {
    const where: Record<string, unknown> = { provider: { id: providerId } };
    if (date) where['busyDate'] = date;
    return this.busySlotRepository.find({
      where,
      order: { busyDate: 'ASC', startTime: 'ASC' },
    });
  }

  async createBusySlot(
    providerId: string,
    dto: { busyDate: string; startTime: string; endTime: string; reason?: string },
  ): Promise<ProviderBusySlot> {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }
    const slot = this.busySlotRepository.create({
      provider,
      busyDate: dto.busyDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      reason: dto.reason,
    });
    return this.busySlotRepository.save(slot);
  }

  async deleteBusySlot(providerId: string, slotId: string): Promise<void> {
    const slot = await this.busySlotRepository.findOne({
      where: { id: slotId, provider: { id: providerId } },
    });
    if (!slot) throw new NotFoundException('Busy slot not found');
    await this.busySlotRepository.remove(slot);
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
