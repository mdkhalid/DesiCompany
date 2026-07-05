import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { BookingCharge } from './entities/booking-charge.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { ProviderService } from '../services/entities/provider-service.entity';
import { Message } from '../chat/entities/message.entity';
import { ChatGateway } from '../chat/chat.gateway';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { getStatusChatTemplate, formatTemplate } from './chat-templates';
import { UserRole } from '../common/enums/user-role.enum';
import { CommissionType } from '../common/enums/commission-type.enum';
import { ProviderAvailability } from '../services/entities/provider-availability.entity';
import { ProviderDateOverride } from '../services/entities/provider-date-override.entity';
import { ProviderBusySlot } from '../services/entities/provider-busy-slot.entity';
import { CommissionService } from '../commissions/commission.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PlatformFeesService } from '../platform-fees/platform-fees.service';
import { JobRequest } from '../quotes/entities/job-request.entity';
import { JobRequestStatus } from '../quotes/entities/job-request-status.enum';
import {
  CreateBookingDto,
  UpdateBookingStatusDto,
  RescheduleBookingDto,
  ProposeNewTimeDto,
} from './dto/create-booking.dto';
import { AddBookingChargeDto } from './dto/add-booking-charge.dto';
import { BookingServiceItem } from './entities/booking-service-item.entity';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

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
    @InjectRepository(BookingServiceItem)
    private readonly bookingServiceItemRepository: Repository<BookingServiceItem>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(ProviderAvailability)
    private readonly availabilityRepository: Repository<ProviderAvailability>,
    @InjectRepository(ProviderDateOverride)
    private readonly dateOverrideRepository: Repository<ProviderDateOverride>,
    @InjectRepository(ProviderBusySlot)
    private readonly busySlotRepository: Repository<ProviderBusySlot>,
    @InjectRepository(JobRequest)
    private readonly jobRequestRepository: Repository<JobRequest>,
    private readonly chatGateway: ChatGateway,
    private readonly commissionService: CommissionService,
    private readonly notificationsService: NotificationsService,
    private readonly pushNotificationsService: PushNotificationsService,
    private readonly loyaltyService: LoyaltyService,
    private readonly platformFeesService: PlatformFeesService,
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
      relations: { user: true },
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

    await this.validateBookingSlot(provider.id, dto.scheduledDate);

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
      serviceAddress: dto.serviceAddress,
      serviceCity: dto.serviceCity,
      isEmergency: dto.isEmergency || false,
      status: BookingStatus.REQUESTED,
    });

    const saved = await this.bookingRepository.save(booking);

    // Add additional service items for multi-service booking
    if (dto.additionalServices && dto.additionalServices.length > 0) {
      let sequence = 1;
      for (const item of dto.additionalServices) {
        const additionalService = await this.providerServiceRepository.findOne({
          where: {
            id: item.providerServiceId,
            provider: { id: provider.id },
            isActive: true,
          },
        });
        if (additionalService) {
          const rate = Number(
            additionalService.fixedRate || additionalService.hourlyRate || 0,
          );
          const bookingItem = this.bookingServiceItemRepository.create({
            booking: saved,
            providerService: additionalService,
            sequenceOrder: sequence++,
            rateAtBooking: rate,
            estimatedHours: item.estimatedHours ?? null,
            estimatedDays: item.estimatedDays ?? null,
          });
          await this.bookingServiceItemRepository.save(bookingItem);
        }
      }
    }

    // Notify provider of new booking request (fire-and-forget)
    this.pushNotificationsService
      .sendToUser(
        provider.user.id,
        'New Booking Request',
        'You have a new booking request. Please review and respond.',
        { bookingId: saved.id },
      )
      .catch(() => {});

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
        quote: true,
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

    // Send a system message to the booking chat for status updates
    await this.sendBookingStatusChatMessage(saved, dto.status).catch((err) =>
      this.logger.warn(
        `Failed to save status chat message: ${(err as Error).message}`,
      ),
    );

    if (dto.status === BookingStatus.COMPLETED) {
      const recalculated = await this.recalculateTotals(saved.id);
      // Award loyalty points to customer for completed booking
      this.loyaltyService
        .awardPointsForBooking(
          saved.customer.user.id,
          Number(recalculated.totalAmount),
        )
        .catch((err) => console.error('Loyalty award failed:', err));

      // Close the associated job request if this booking was created from a quote
      if (saved.quote?.id) {
        const jobRequest = await this.jobRequestRepository.findOne({
          where: { acceptedQuoteId: saved.quote.id },
        });
        if (jobRequest && jobRequest.status !== JobRequestStatus.CLOSED && jobRequest.status !== JobRequestStatus.CANCELLED) {
          jobRequest.status = JobRequestStatus.CLOSED;
          await this.jobRequestRepository.save(jobRequest);
        }
      }

      return recalculated;
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
      // In-app notification
      // Tag the notification with the recipient's role context so dual-role
      // users only see it in the correct role's view.
      const recipientRole: UserRole = notification.userId === booking.provider.user.id
        ? UserRole.PROVIDER
        : UserRole.CUSTOMER;
      await this.notificationsService.create(
        notification.userId,
        notification.title,
        notification.message,
        'booking',
        { bookingId: booking.id },
        recipientRole,
      );

      // Push notification (fire-and-forget)
      this.pushNotificationsService
        .sendToUser(
          notification.userId,
          notification.title,
          notification.message,
          { bookingId: booking.id, status },
        )
        .catch(() => {});
    }
  }

  private async sendBookingStatusChatMessage(
    booking: Booking,
    status: BookingStatus,
  ): Promise<void> {
    const template = getStatusChatTemplate(status);
    if (!template) return; // no template defined for this status (e.g. REQUESTED)

    const providerName =
      `${booking.provider.firstName || ''} ${booking.provider.lastName || ''}`.trim();
    const customerName =
      `${booking.customer.firstName || ''} ${booking.customer.lastName || ''}`.trim();
    const customerUserId = booking.customer.user.id;
    const providerUserId = booking.provider.user.id;

    const placeholders = { providerName, customerName };
    const customerContent = formatTemplate(template.customer, placeholders);
    const providerContent = formatTemplate(template.provider, placeholders);

    await this.chatGateway.emitRoleSpecificSystemMessage(
      booking.id,
      customerUserId,
      providerUserId,
      customerContent,
      providerContent,
      { type: 'status_update', status },
    );
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

  async proposeNewTime(
    id: string,
    dto: ProposeNewTimeDto,
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
        'Cannot propose new time for a completed, cancelled, or rejected booking',
      );
    }

    booking.proposedDate = new Date(dto.proposedDate);
    booking.status = BookingStatus.PROPOSED_NEW_TIME;
    const saved = await this.bookingRepository.save(booking);

    // Notify the other party about the proposal
    const providerName = `${booking.provider.firstName} ${booking.provider.lastName}`;
    const notifyUserId =
      role === UserRole.PROVIDER
        ? booking.customer.user.id
        : booking.provider.user.id;
    const proposeBy =
      role === UserRole.PROVIDER ? providerName : 'The customer';

    await this.notificationsService.create(
      notifyUserId,
      'New Time Proposed',
      `${proposeBy} proposed a new time for the service.`,
      'booking',
      { bookingId: saved.id },
      role === UserRole.PROVIDER ? UserRole.CUSTOMER : UserRole.PROVIDER,
    );

    this.pushNotificationsService
      .sendToUser(
        notifyUserId,
        'New Time Proposed',
        `${proposeBy} proposed a new time for the service.`,
        { bookingId: saved.id },
      )
      .catch(() => {});

    return saved;
  }

  async respondToProposal(
    id: string,
    accept: boolean,
    userId: string,
    role: UserRole,
  ) {
    const booking = await this.findOne(id);

    if (booking.status !== BookingStatus.PROPOSED_NEW_TIME) {
      throw new BadRequestException('No active time proposal for this booking');
    }

    this.ensureBookingAccess(booking, userId, role);

    if (accept) {
      if (booking.proposedDate) {
        booking.scheduledDate = booking.proposedDate;
      }
      booking.status = BookingStatus.REQUESTED;
      booking.proposedDate = null;
    } else {
      booking.proposedDate = null;
      booking.status = BookingStatus.REQUESTED;
    }

    const saved = await this.bookingRepository.save(booking);

    // Notify the proposer
    const notifyUserId =
      role === UserRole.PROVIDER
        ? booking.customer.user.id
        : booking.provider.user.id;
    const decision = accept ? 'accepted' : 'declined';

    await this.notificationsService.create(
      notifyUserId,
      `Proposal ${decision.charAt(0).toUpperCase() + decision.slice(1)}`,
      `The proposed new time has been ${decision}.`,
      'booking',
      { bookingId: saved.id },
      role === UserRole.PROVIDER ? UserRole.CUSTOMER : UserRole.PROVIDER,
    );

    this.pushNotificationsService
      .sendToUser(
        notifyUserId,
        `Proposal ${decision.charAt(0).toUpperCase() + decision.slice(1)}`,
        `The proposed new time has been ${decision}.`,
        { bookingId: saved.id },
      )
      .catch(() => {});

    return saved;
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

  private async validateBookingSlot(providerId: string, scheduledDate: string) {
    const dateObj = new Date(scheduledDate);
    const dateStr = dateObj.toISOString().slice(0, 10);
    const dayOfWeek = dateObj.getDay();
    const bookingMinutes = dateObj.getHours() * 60 + dateObj.getMinutes();

    const override = await this.dateOverrideRepository.findOne({
      where: { provider: { id: providerId }, overrideDate: dateStr },
    });

    if (override) {
      if (!override.isAvailable) {
        throw new BadRequestException(
          `Provider is not available on ${dateStr}: ${override.reason || 'day off'}`,
        );
      }
      if (override.startTime && override.endTime) {
        const [sH, sM] = override.startTime.split(':').map(Number);
        const [eH, eM] = override.endTime.split(':').map(Number);
        const overrideStart = sH * 60 + sM;
        const overrideEnd = eH * 60 + eM;
        if (bookingMinutes < overrideStart || bookingMinutes >= overrideEnd) {
          throw new BadRequestException(
            `Booking time falls outside provider's special hours (${override.startTime}-${override.endTime}) on ${dateStr}`,
          );
        }
      }
      return;
    }

    const availabilities = await this.availabilityRepository.find({
      where: { provider: { id: providerId }, dayOfWeek },
    });

    if (availabilities.length === 0) {
      throw new BadRequestException(
        'Provider is not available on this day of the week',
      );
    }

    const inAnySlot = availabilities.some((a) => {
      const [sH, sM] = a.startTime.split(':').map(Number);
      const [eH, eM] = a.endTime.split(':').map(Number);
      const slotStart = sH * 60 + sM;
      const slotEnd = eH * 60 + eM;
      return bookingMinutes >= slotStart && bookingMinutes < slotEnd;
    });

    if (!inAnySlot) {
      throw new BadRequestException(
        "Booking time falls outside provider's available hours",
      );
    }

    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);

    const estimatedHours = 1;
    const bookingEnd = bookingMinutes + estimatedHours * 60;

    const conflictingBookings = await this.bookingRepository.find({
      where: {
        provider: { id: providerId },
        status: In([
          BookingStatus.REQUESTED,
          BookingStatus.ACCEPTED,
          BookingStatus.ON_THE_WAY,
          BookingStatus.WORKING,
        ]),
      },
      select: { id: true, scheduledDate: true, estimatedHours: true },
    });

    // Check provider-marked busy slots
    const busySlots = await this.busySlotRepository.find({
      where: { provider: { id: providerId }, busyDate: dateStr },
    });
    const inBusySlot = busySlots.some((bs) => {
      const [bsH, bsM] = bs.startTime.split(':').map(Number);
      const [beH, beM] = bs.endTime.split(':').map(Number);
      const busyStart = bsH * 60 + bsM;
      const busyEnd = beH * 60 + beM;
      return bookingMinutes < busyEnd && bookingEnd > busyStart;
    });
    if (inBusySlot) {
      throw new BadRequestException('Provider is not available during this time');
    }

    const hasConflict = conflictingBookings.some((b) => {
      const bDate = new Date(b.scheduledDate);
      if (bDate < dateObj || bDate >= nextDay) return false;
      const bStart = bDate.getHours() * 60 + bDate.getMinutes();
      const bEnd = bStart + (b.estimatedHours || 1) * 60;
      return bookingMinutes < bEnd && bookingEnd > bStart;
    });

    if (hasConflict) {
      throw new BadRequestException(
        'This time slot conflicts with an existing booking',
      );
    }
  }

  private async recalculateTotals(bookingId: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: {
        providerService: { category: true },
        provider: true,
        charges: true,
        serviceItems: { providerService: { category: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // If no providerService and no service items, preserve existing totalAmount
    // This handles bookings created from quotes where amount is already set
    if (!booking.providerService && (!booking.serviceItems || booking.serviceItems.length === 0)) {
      return booking;
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

    // Add additional services to base amount
    const additionalServiceTotal = (booking.serviceItems || []).reduce(
      (sum, item) => {
        if (item.estimatedHours) {
          return sum + Number(item.rateAtBooking) * Number(item.estimatedHours);
        }
        if (item.estimatedDays) {
          return sum + Number(item.rateAtBooking) * Number(item.estimatedDays);
        }
        return sum + Number(item.rateAtBooking);
      },
      0,
    );
    baseAmount += additionalServiceTotal;

    // Apply multi-service bundle discount if more than 1 service
    const totalServiceCount = 1 + (booking.serviceItems?.length || 0);
    if (totalServiceCount > 1) {
      const bundleDiscount = parseFloat(
        process.env.MULTI_SERVICE_BUNDLE_DISCOUNT || '10',
      );
      baseAmount = baseAmount * (1 - bundleDiscount / 100);
    }

    // Apply emergency multiplier if this is an emergency booking
    if (booking.isEmergency) {
      const emergencyMultiplier = parseFloat(
        process.env.EMERGENCY_PRICE_MULTIPLIER || '1.5',
      );
      baseAmount = baseAmount * emergencyMultiplier;
    }

    const serviceAmount =
      baseAmount +
      (booking.charges || []).reduce(
        (sum, charge) =>
          charge.chargeType === 'convenience_fee'
            ? sum
            : sum + Number(charge.amount),
        0,
      );

    // Calculate convenience fee
    const fee = await this.platformFeesService.getConvenienceFee(serviceAmount);
    booking.convenienceFee = fee.finalFee;

    // Create or update the convenience fee charge for audit trail
    const existingFeeCharge = (booking.charges || []).find(
      (c) => c.chargeType === 'convenience_fee',
    );
    if (fee.finalFee > 0) {
      if (existingFeeCharge) {
        existingFeeCharge.amount = fee.finalFee;
        await this.chargeRepository.save(existingFeeCharge);
      } else {
        const feeCharge = this.chargeRepository.create({
          booking: { id: booking.id },
          chargeType: 'convenience_fee',
          amount: fee.finalFee,
          description: 'Platform convenience fee',
        });
        await this.chargeRepository.save(feeCharge);
      }
    } else if (existingFeeCharge) {
      await this.chargeRepository.remove(existingFeeCharge);
    }

    // Total = service amount + convenience fee (commission is on service amount only)
    const totalAmount = serviceAmount + fee.finalFee;

    // Commission lookup: provider scope → category scope → global fallback
    const providerId = booking.provider?.id;
    const categoryId = service?.category?.id;

    let commission;
    if (providerId) {
      commission = await this.commissionService.getCommission(
        serviceAmount,
        'provider',
        providerId,
      );
    }
    if (!commission || commission.amount === serviceAmount * 0.1) {
      // No provider-specific config found (fell through to default 10%), try category
      if (categoryId) {
        const categoryCommission = await this.commissionService.getCommission(
          serviceAmount,
          'category',
          categoryId,
        );
        // Only use category commission if it differs from the default fallback
        if (
          categoryCommission.type !== CommissionType.PERCENTAGE ||
          categoryCommission.value !== 10 ||
          categoryId
        ) {
          commission = categoryCommission;
        }
      }
    }

    if (!commission) {
      // If no commission found, default to 0
      commission = { amount: 0, type: CommissionType.PERCENTAGE, value: 0 };
    }

    booking.totalAmount = totalAmount;
    booking.commissionAmount = commission.amount;
    booking.providerAmount = serviceAmount - commission.amount;

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
        BookingStatus.PROPOSED_NEW_TIME,
      ],
      [BookingStatus.ACCEPTED]: [
        BookingStatus.ON_THE_WAY,
        BookingStatus.CANCELLED,
        BookingStatus.PROPOSED_NEW_TIME,
      ],
      [BookingStatus.ON_THE_WAY]: [BookingStatus.WORKING],
      [BookingStatus.WORKING]: [BookingStatus.COMPLETED],
      [BookingStatus.COMPLETED]: [],
      [BookingStatus.CANCELLED]: [],
      [BookingStatus.REJECTED]: [],
      [BookingStatus.PROPOSED_NEW_TIME]: [
        BookingStatus.REQUESTED,
        BookingStatus.CANCELLED,
      ],
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
