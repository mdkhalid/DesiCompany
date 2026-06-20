import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { BookingCharge } from './entities/booking-charge.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { ProviderService } from '../services/entities/provider-service.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { CommissionService } from '../commissions/commission.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateBookingDto,
  UpdateBookingStatusDto,
  RescheduleBookingDto,
} from './dto/create-booking.dto';
import { AddBookingChargeDto } from './dto/add-booking-charge.dto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(BookingCharge)
    private readonly chargeRepository: Repository<BookingCharge>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(ProviderService)
    private readonly providerServiceRepository: Repository<ProviderService>,
    private readonly commissionService: CommissionService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createByUser(userId: string, dto: CreateBookingDto) {
    const customer = await this.customerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found for this user');
    }
    return this.create({ ...dto, customerId: customer.id });
  }

  async create(dto: CreateBookingDto) {
    const customer = await this.customerRepository.findOne({
      where: { id: dto.customerId },
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
    if (!provider.isVerified) {
      throw new BadRequestException('Provider is not verified');
    }
    if (provider.isSoftBlocked) {
      throw new BadRequestException(
        'Provider is temporarily suspended due to outstanding commissions',
      );
    }

    const providerService = await this.providerServiceRepository.findOne({
      where: {
        id: dto.providerServiceId,
        provider: { id: provider.id },
        isActive: true,
      },
      relations: { category: true },
    });
    if (!providerService) {
      throw new NotFoundException('Provider service not found or inactive');
    }

    const booking = this.bookingRepository.create({
      customer,
      provider,
      providerService,
      scheduledDate: new Date(dto.scheduledDate),
      description: dto.description,
      status: BookingStatus.REQUESTED,
    });

    const saved = await this.bookingRepository.save(booking);
    return this.recalculateTotals(saved.id);
  }

  async findByCustomerUser(userId: string) {
    const customer = await this.customerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!customer) return [];
    return this.findByCustomer(customer.id);
  }

  async findByProviderUser(userId: string) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) return [];
    return this.findByProvider(provider.id);
  }

  async findByCustomer(customerId: string) {
    return this.bookingRepository.find({
      where: { customer: { id: customerId } },
      relations: {
        provider: { user: true },
        providerService: { category: true },
        charges: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findByProvider(providerId: string) {
    return this.bookingRepository.find({
      where: { provider: { id: providerId } },
      relations: {
        customer: { user: true },
        providerService: { category: true },
        charges: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: {
        customer: { user: true },
        provider: { user: true },
        providerService: { category: true },
        charges: true,
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  async updateStatus(
    id: string,
    dto: UpdateBookingStatusDto,
    userId: string,
    role: UserRole,
  ) {
    const booking = await this.findOne(id);

    this.validateStatusTransition(booking.status, dto.status, role);
    this.ensureBookingAccess(booking, userId, role);

    booking.status = dto.status;
    const saved = await this.bookingRepository.save(booking);

    await this.sendStatusNotification(saved, dto.status);

    if (dto.status === BookingStatus.COMPLETED) {
      return this.recalculateTotals(saved.id);
    }

    return saved;
  }

  private async sendStatusNotification(
    booking: Booking,
    status: BookingStatus,
  ) {
    const providerName = `${booking.provider.firstName} ${booking.provider.lastName}`;
    const customerUser = booking.customer.user;

    const messages: Record<
      string,
      { userId: string; title: string; message: string }
    > = {
      [BookingStatus.ACCEPTED]: {
        userId: customerUser.id,
        title: 'Booking Accepted',
        message: `${providerName} has accepted your booking.`,
      },
      [BookingStatus.REJECTED]: {
        userId: customerUser.id,
        title: 'Booking Rejected',
        message: `${providerName} has rejected your booking.`,
      },
      [BookingStatus.ON_THE_WAY]: {
        userId: customerUser.id,
        title: 'Provider On The Way',
        message: `${providerName} is on the way to your location.`,
      },
      [BookingStatus.WORKING]: {
        userId: customerUser.id,
        title: 'Service Started',
        message: `${providerName} has started working on your service.`,
      },
      [BookingStatus.COMPLETED]: {
        userId: customerUser.id,
        title: 'Booking Completed',
        message: `${providerName} has completed your booking. Please rate your experience.`,
      },
      [BookingStatus.CANCELLED]: {
        userId: booking.provider.user.id,
        title: 'Booking Cancelled',
        message: 'A booking has been cancelled by the customer.',
      },
    };

    const notification = messages[status];
    if (notification) {
      await this.notificationsService.create(
        notification.userId,
        notification.title,
        notification.message,
      );
    }
  }

  async reschedule(
    id: string,
    dto: RescheduleBookingDto,
    userId: string,
    role: UserRole,
  ) {
    const booking = await this.findOne(id);
    this.ensureBookingAccess(booking, userId, role);

    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Cannot reschedule a completed, cancelled, or rejected booking',
      );
    }

    booking.scheduledDate = new Date(dto.scheduledDate);
    return this.bookingRepository.save(booking);
  }

  async addCharge(dto: AddBookingChargeDto, userId: string, role: UserRole) {
    const booking = await this.findOne(dto.bookingId);

    if (role === UserRole.PROVIDER && booking.provider.user.id !== userId) {
      throw new ForbiddenException(
        'You can only add charges to your own bookings',
      );
    }

    if (
      booking.status !== BookingStatus.ACCEPTED &&
      booking.status !== BookingStatus.ON_THE_WAY &&
      booking.status !== BookingStatus.WORKING
    ) {
      throw new BadRequestException(
        'Charges can only be added while booking is in progress',
      );
    }

    const charge = this.chargeRepository.create({
      booking,
      chargeType: dto.chargeType,
      amount: dto.amount,
      description: dto.description,
    });
    await this.chargeRepository.save(charge);

    return this.recalculateTotals(booking.id);
  }

  async removeCharge(chargeId: string, userId: string, role: UserRole) {
    const charge = await this.chargeRepository.findOne({
      where: { id: chargeId },
      relations: { booking: { provider: { user: true } } },
    });
    if (!charge) {
      throw new NotFoundException('Charge not found');
    }

    if (
      role === UserRole.PROVIDER &&
      charge.booking.provider.user.id !== userId
    ) {
      throw new ForbiddenException(
        'You can only remove charges from your own bookings',
      );
    }

    await this.chargeRepository.remove(charge);
    return this.recalculateTotals(charge.booking.id);
  }

  private async recalculateTotals(bookingId: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: { providerService: { category: true }, charges: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    let baseAmount = 0;
    const service = booking.providerService;
    if (service) {
      if (service.fixedRate) {
        baseAmount = Number(service.fixedRate);
      } else if (service.hourlyRate && booking.estimatedHours) {
        baseAmount =
          Number(service.hourlyRate) * Number(booking.estimatedHours);
      } else if (service.dailyRate && booking.estimatedDays) {
        baseAmount = Number(service.dailyRate) * Number(booking.estimatedDays);
      }
    }

    const chargesTotal = (booking.charges || []).reduce(
      (sum, charge) => sum + Number(charge.amount),
      0,
    );
    const totalAmount = baseAmount + chargesTotal;

    const categoryId = service?.category?.id;
    const commission = await this.commissionService.getCommission(
      totalAmount,
      'category',
      categoryId,
    );

    booking.totalAmount = totalAmount;
    booking.commissionAmount = commission.amount;
    booking.providerAmount = totalAmount - commission.amount;

    return this.bookingRepository.save(booking);
  }

  private validateStatusTransition(
    current: BookingStatus,
    next: BookingStatus,
    role: UserRole,
  ) {
    const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.REQUESTED]: [
        BookingStatus.ACCEPTED,
        BookingStatus.REJECTED,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.ACCEPTED]: [
        BookingStatus.ON_THE_WAY,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.ON_THE_WAY]: [BookingStatus.WORKING],
      [BookingStatus.WORKING]: [BookingStatus.COMPLETED],
      [BookingStatus.COMPLETED]: [],
      [BookingStatus.CANCELLED]: [],
      [BookingStatus.REJECTED]: [],
    };

    if (!allowedTransitions[current]?.includes(next)) {
      throw new BadRequestException(
        `Cannot transition from ${current} to ${next}`,
      );
    }

    const providerOnlyStatuses = [
      BookingStatus.ACCEPTED,
      BookingStatus.REJECTED,
      BookingStatus.ON_THE_WAY,
      BookingStatus.WORKING,
      BookingStatus.COMPLETED,
    ];
    if (
      providerOnlyStatuses.includes(next) &&
      role !== UserRole.PROVIDER &&
      role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only providers can perform this status update',
      );
    }
  }

  private ensureBookingAccess(
    booking: Booking,
    userId: string,
    role: UserRole,
  ) {
    if (role === UserRole.ADMIN) {
      return;
    }
    if (role === UserRole.CUSTOMER && booking.customer.user.id !== userId) {
      throw new ForbiddenException('You can only access your own bookings');
    }
    if (role === UserRole.PROVIDER && booking.provider.user.id !== userId) {
      throw new ForbiddenException('You can only access your own bookings');
    }
  }
}
