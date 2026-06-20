import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { RecurringBooking, RecurrenceFrequency, RecurrenceStatus } from './entities/recurring-booking.entity';
import { Booking } from './entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { ProviderService } from '../services/entities/provider-service.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateRecurringBookingDto, UpdateRecurringBookingDto } from './dto/recurring-booking.dto';

@Injectable()
export class RecurringBookingsService {
  constructor(
    @InjectRepository(RecurringBooking)
    private readonly recurringRepository: Repository<RecurringBooking>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(ProviderService)
    private readonly providerServiceRepository: Repository<ProviderService>,
  ) {}

  async create(userId: string, dto: CreateRecurringBookingDto) {
    const customer = await this.customerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const provider = await this.providerRepository.findOne({
      where: { id: dto.providerId },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const providerService = await this.providerServiceRepository.findOne({
      where: {
        id: dto.providerServiceId,
        provider: { id: dto.providerId },
        isActive: true,
      },
    });
    if (!providerService) {
      throw new NotFoundException('Provider service not found or inactive');
    }

    if (
      dto.frequency === RecurrenceFrequency.WEEKLY ||
      dto.frequency === RecurrenceFrequency.BI_WEEKLY
    ) {
      if (dto.dayOfWeek === undefined) {
        throw new BadRequestException('dayOfWeek is required for weekly/bi-weekly recurrence');
      }
    }

    if (dto.frequency === RecurrenceFrequency.MONTHLY) {
      if (dto.dayOfMonth === undefined) {
        throw new BadRequestException('dayOfMonth is required for monthly recurrence');
      }
    }

    const nextDate = this.calculateNextOccurrence(
      dto.startDate,
      dto.frequency,
      dto.dayOfWeek,
      dto.dayOfMonth,
    );

    const recurring = this.recurringRepository.create({
      customer,
      provider,
      providerService,
      frequency: dto.frequency,
      dayOfWeek: dto.dayOfWeek ?? null,
      dayOfMonth: dto.dayOfMonth ?? null,
      preferredTime: dto.preferredTime ?? null,
      description: dto.description ?? null,
      status: RecurrenceStatus.ACTIVE,
      nextOccurrenceDate: nextDate,
    });

    return this.recurringRepository.save(recurring);
  }

  async findAll(userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) {
      return this.recurringRepository.find({
        relations: { customer: { user: true }, provider: { user: true }, providerService: { category: true } },
        order: { createdAt: 'DESC' },
      });
    }

    if (role === UserRole.CUSTOMER) {
      const customer = await this.customerRepository.findOne({
        where: { user: { id: userId } },
      });
      if (!customer) return [];
      return this.recurringRepository.find({
        where: { customer: { id: customer.id } },
        relations: { provider: { user: true }, providerService: { category: true } },
        order: { createdAt: 'DESC' },
      });
    }

    if (role === UserRole.PROVIDER) {
      const provider = await this.providerRepository.findOne({
        where: { user: { id: userId } },
      });
      if (!provider) return [];
      return this.recurringRepository.find({
        where: { provider: { id: provider.id } },
        relations: { customer: { user: true }, providerService: { category: true } },
        order: { createdAt: 'DESC' },
      });
    }

    return [];
  }

  async findOne(id: string) {
    const recurring = await this.recurringRepository.findOne({
      where: { id },
      relations: {
        customer: { user: true },
        provider: { user: true },
        providerService: { category: true },
      },
    });
    if (!recurring) {
      throw new NotFoundException('Recurring booking not found');
    }
    return recurring;
  }

  async updateStatus(
    id: string,
    dto: UpdateRecurringBookingDto,
    userId: string,
    role: UserRole,
  ) {
    const recurring = await this.findOne(id);
    this.ensureAccess(recurring, userId, role);

    if (dto.status) {
      const newStatus = dto.status as RecurrenceStatus;
      if (!Object.values(RecurrenceStatus).includes(newStatus)) {
        throw new BadRequestException('Invalid status');
      }
      recurring.status = newStatus;
    }

    if (dto.preferredTime) {
      recurring.preferredTime = dto.preferredTime;
    }

    return this.recurringRepository.save(recurring);
  }

  async generateOccurrence(recurringBookingId: string) {
    const recurring = await this.recurringRepository.findOne({
      where: { id: recurringBookingId },
      relations: {
        customer: { user: true },
        provider: { user: true },
        providerService: true,
      },
    });

    if (!recurring || recurring.status !== RecurrenceStatus.ACTIVE) {
      return null;
    }

    const scheduledDate = new Date(recurring.nextOccurrenceDate);
    if (recurring.preferredTime) {
      const [hours, minutes] = recurring.preferredTime.split(':').map(Number);
      scheduledDate.setHours(hours, minutes, 0, 0);
    }

    const booking = this.bookingRepository.create({
      customer: recurring.customer,
      provider: recurring.provider,
      providerService: recurring.providerService,
      scheduledDate,
      description: recurring.description ?? undefined,
      status: BookingStatus.REQUESTED,
    });

    const saved = await this.bookingRepository.save(booking);

    recurring.lastOccurrenceDate = recurring.nextOccurrenceDate;
    recurring.nextOccurrenceDate = this.calculateNextOccurrence(
      recurring.nextOccurrenceDate,
      recurring.frequency,
      recurring.dayOfWeek,
      recurring.dayOfMonth,
    );

    await this.recurringRepository.save(recurring);

    return saved;
  }

  async processDueRecurringBookings() {
    const today = new Date().toISOString().split('T')[0];
    const dueBookings = await this.recurringRepository.find({
      where: {
        status: RecurrenceStatus.ACTIVE,
        nextOccurrenceDate: LessThanOrEqual(today),
      },
    });

    const createdBookings = [];
    for (const recurring of dueBookings) {
      const booking = await this.generateOccurrence(recurring.id);
      if (booking) {
        createdBookings.push(booking);
      }
    }

    return createdBookings;
  }

  private calculateNextOccurrence(
    currentDate: string,
    frequency: RecurrenceFrequency,
    dayOfWeek?: number | null,
    dayOfMonth?: number | null,
  ): string {
    const date = new Date(currentDate);

    switch (frequency) {
      case RecurrenceFrequency.WEEKLY:
        date.setDate(date.getDate() + 7);
        break;
      case RecurrenceFrequency.BI_WEEKLY:
        date.setDate(date.getDate() + 14);
        break;
      case RecurrenceFrequency.MONTHLY:
        date.setMonth(date.getMonth() + 1);
        if (dayOfMonth) {
          date.setDate(Math.min(dayOfMonth, 28));
        }
        break;
    }

    return date.toISOString().split('T')[0];
  }

  private ensureAccess(recurring: RecurringBooking, userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.CUSTOMER && recurring.customer.user.id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (role === UserRole.PROVIDER && recurring.provider.user.id !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }
}
