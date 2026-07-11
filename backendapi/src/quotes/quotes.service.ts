import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { PricingModel } from '../common/enums/pricing-model.enum';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { ProviderService } from '../services/entities/provider-service.entity';
import { Message } from '../chat/entities/message.entity';
import { ChatGateway } from '../chat/chat.gateway';
import { getBookingConfirmationMessages } from '../bookings/chat-templates';
import { CreateJobRequestDto } from './dto/create-job-request.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { JobRequest } from './entities/job-request.entity';
import { JobRequestStatus } from './entities/job-request-status.enum';
import { Quote } from './entities/quote.entity';
import { QuoteStatus } from './entities/quote-status.enum';
import { QuoteItem } from './entities/quote-item.entity';
import { PlatformFeesService } from '../platform-fees/platform-fees.service';

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    @InjectRepository(JobRequest)
    private readonly jobRequestRepository: Repository<JobRequest>,
    @InjectRepository(Quote)
    private readonly quoteRepository: Repository<Quote>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(ServiceCategory)
    private readonly categoryRepository: Repository<ServiceCategory>,
    @InjectRepository(ProviderService)
    private readonly providerServiceRepository: Repository<ProviderService>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(QuoteItem)
    private readonly quoteItemRepository: Repository<QuoteItem>,
    private readonly platformFeesService: PlatformFeesService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async createJobRequest(dto: CreateJobRequestDto, userId: string) {
    const customer = await this.customerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found for this user');
    }

    const category = await this.categoryRepository.findOne({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Service category not found');
    }

    const jobRequest = this.jobRequestRepository.create({
      customer,
      category,
      title: dto.title,
      description: dto.description,
      address: dto.address,
      locality: dto.locality,
      city: dto.city,
      latitude: dto.latitude,
      longitude: dto.longitude,
      budgetMin: dto.budgetMin,
      budgetMax: dto.budgetMax,
      preferredDate: dto.preferredDate
        ? new Date(dto.preferredDate)
        : undefined,
      status: JobRequestStatus.OPEN,
    });

    return this.jobRequestRepository.save(jobRequest);
  }

  async findOpenJobRequests(
    categoryId?: string,
    lat?: number,
    lng?: number,
    radiusKm?: number,
  ) {
    const query = this.jobRequestRepository
      .createQueryBuilder('jobRequest')
      .leftJoinAndSelect('jobRequest.category', 'category')
      .leftJoinAndSelect('jobRequest.customer', 'customer')
      .leftJoinAndSelect('customer.user', 'customerUser')
      .leftJoinAndSelect('jobRequest.quotes', 'quotes')
      .where(
        new Brackets((qb) => {
          qb.where('jobRequest.status = :open', {
            open: JobRequestStatus.OPEN,
          }).orWhere(
            '(jobRequest.status = :quoted AND jobRequest.updatedAt >= :recent)',
            {
              quoted: JobRequestStatus.QUOTED,
              recent: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          );
        }),
      );

    if (categoryId) {
      query.andWhere('category.id = :categoryId', { categoryId });
    }

    if (lat !== undefined && lng !== undefined && radiusKm) {
      const radius = radiusKm * 1000;
      query.addSelect(
        `6371000 * acos(
          cos(radians(:lat)) * cos(radians(jobRequest.latitude)) *
          cos(radians(jobRequest.longitude) - radians(:lng)) +
          sin(radians(:lat)) * sin(radians(jobRequest.latitude))
        )`,
        'distance',
      );
      query.setParameters({ lat, lng });
      query.andWhere(
        `6371000 * acos(
          cos(radians(:lat)) * cos(radians(jobRequest.latitude)) *
          cos(radians(jobRequest.longitude) - radians(:lng)) +
          sin(radians(:lat)) * sin(radians(jobRequest.latitude))
        ) <= :radius`,
        { radius },
      );
      query.orderBy('distance', 'ASC');
    } else {
      query.orderBy('jobRequest.createdAt', 'DESC');
    }

    return query.getMany();
  }

  async findMyJobRequests(userId: string) {
    const customer = await this.customerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!customer) return [];

    return this.jobRequestRepository.find({
      where: { customer: { id: customer.id } },
      relations: {
        category: true,
        customer: { user: true },
        quotes: { provider: { user: true } },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findJobRequestById(id: string) {
    const jobRequest = await this.jobRequestRepository.findOne({
      where: { id },
      relations: {
        customer: { user: true },
        category: true,
        quotes: { provider: { user: true } },
      },
    });
    if (!jobRequest) {
      throw new NotFoundException('Job request not found');
    }
    return jobRequest;
  }

  async cancelJobRequest(id: string, userId: string) {
    const jobRequest = await this.jobRequestRepository.findOne({
      where: { id },
      relations: { customer: { user: true } },
    });
    if (!jobRequest) {
      throw new NotFoundException('Job request not found');
    }

    if (jobRequest.customer.user.id !== userId) {
      throw new ForbiddenException('You can only cancel your own job requests');
    }

    if (jobRequest.status === JobRequestStatus.ACCEPTED) {
      throw new BadRequestException(
        'Cannot cancel a job request that has been accepted',
      );
    }

    if (
      jobRequest.status === JobRequestStatus.CANCELLED ||
      jobRequest.status === JobRequestStatus.CLOSED
    ) {
      throw new BadRequestException(
        `Job request is already ${jobRequest.status}`,
      );
    }

    jobRequest.status = JobRequestStatus.CANCELLED;
    return this.jobRequestRepository.save(jobRequest);
  }

  async createQuote(
    jobRequestId: string,
    dto: CreateQuoteDto,
    providerUserId: string,
  ) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: providerUserId } },
    });
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const jobRequest = await this.jobRequestRepository.findOne({
      where: { id: jobRequestId },
    });
    if (!jobRequest) {
      throw new NotFoundException('Job request not found');
    }

    if (
      jobRequest.status !== JobRequestStatus.OPEN &&
      jobRequest.status !== JobRequestStatus.QUOTED
    ) {
      throw new BadRequestException(
        `Cannot quote on a ${jobRequest.status} job request`,
      );
    }

    const existing = await this.quoteRepository.findOne({
      where: {
        jobRequest: { id: jobRequest.id },
        provider: { id: provider.id },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'You have already submitted a quote for this job request',
      );
    }

    const quote = this.quoteRepository.create({
      jobRequest,
      provider,
      amount: dto.amount,
      message: dto.message,
      estimatedHours: dto.estimatedHours,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      status: QuoteStatus.PENDING,
    });

    const saved = await this.quoteRepository.save(quote);

    if (dto.items?.length) {
      const items = dto.items.map((item) => {
        const quantity = item.quantity ?? 1;
        const totalPrice = Math.round(quantity * item.unitPrice * 100) / 100;
        return this.quoteItemRepository.create({
          quote: { id: saved.id },
          description: item.description,
          quantity,
          unitPrice: item.unitPrice,
          totalPrice,
        });
      });
      await this.quoteItemRepository.save(items);
    }

    if (jobRequest.status === JobRequestStatus.OPEN) {
      jobRequest.status = JobRequestStatus.QUOTED;
      await this.jobRequestRepository.save(jobRequest);
    }

    // Calculate and log lead/quote fee (non-blocking — doesn't prevent quote submission)
    this.chargeLeadQuoteFee(provider, saved).catch((err) =>
      this.logger.warn(
        `Lead quote fee calculation failed: ${(err as Error).message}`,
      ),
    );

    return this.quoteRepository.findOne({
      where: { id: saved.id },
      relations: {
        items: true,
        provider: { user: true },
        jobRequest: { category: true },
      },
    });
  }

  async findQuotesForJobRequest(jobRequestId: string) {
    return this.quoteRepository.find({
      where: { jobRequest: { id: jobRequestId } },
      relations: {
        provider: { user: true },
        jobRequest: { category: true },
        items: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findMyQuotes(userId: string) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) return [];

    return this.quoteRepository.find({
      where: { provider: { id: provider.id } },
      relations: {
        jobRequest: { category: true, customer: { user: true } },
        items: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async updateQuote(
    quoteId: string,
    dto: UpdateQuoteDto,
    providerUserId: string,
  ) {
    const quote = await this.quoteRepository.findOne({
      where: { id: quoteId },
      relations: { provider: { user: true } },
    });
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.provider.user.id !== providerUserId) {
      throw new ForbiddenException('You can only edit your own quotes');
    }

    if (quote.status !== QuoteStatus.PENDING) {
      throw new BadRequestException(`Cannot edit a ${quote.status} quote`);
    }

    if (dto.amount !== undefined) quote.amount = dto.amount;
    if (dto.message !== undefined) quote.message = dto.message;
    if (dto.estimatedHours !== undefined)
      quote.estimatedHours = dto.estimatedHours;
    if (dto.validUntil !== undefined)
      quote.validUntil = new Date(dto.validUntil);

    return this.quoteRepository.save(quote);
  }

  async withdrawQuote(quoteId: string, userId: string) {
    const quote = await this.quoteRepository.findOne({
      where: { id: quoteId },
      relations: { provider: { user: true } },
    });
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.provider.user.id !== userId) {
      throw new ForbiddenException('You can only withdraw your own quotes');
    }

    if (quote.status !== QuoteStatus.PENDING) {
      throw new BadRequestException(`Cannot withdraw a ${quote.status} quote`);
    }

    quote.status = QuoteStatus.WITHDRAWN;
    return this.quoteRepository.save(quote);
  }

  async acceptQuote(quoteId: string, userId: string, promoCode?: string) {
    const quote = await this.quoteRepository.findOne({
      where: { id: quoteId },
      relations: {
        jobRequest: { customer: { user: true }, category: true },
        provider: { user: true },
      },
    });
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const jobRequest = quote.jobRequest;
    if (jobRequest.customer.user.id !== userId) {
      throw new ForbiddenException(
        'Only the job request owner can accept quotes',
      );
    }

    if (quote.status !== QuoteStatus.PENDING) {
      throw new BadRequestException(`Quote is already ${quote.status}`);
    }

    if (quote.provider.isSoftBlocked) {
      throw new BadRequestException(
        'Provider is temporarily suspended due to outstanding commissions',
      );
    }

    if (
      jobRequest.status !== JobRequestStatus.OPEN &&
      jobRequest.status !== JobRequestStatus.QUOTED
    ) {
      throw new BadRequestException(
        `Cannot accept a quote on a ${jobRequest.status} job request`,
      );
    }

    quote.status = QuoteStatus.ACCEPTED;
    await this.quoteRepository.save(quote);

    await this.quoteRepository
      .createQueryBuilder()
      .update(Quote)
      .set({ status: QuoteStatus.REJECTED })
      .where('job_request_id = :jobRequestId', { jobRequestId: jobRequest.id })
      .andWhere('id != :quoteId', { quoteId: quote.id })
      .andWhere('status = :pending', { pending: QuoteStatus.PENDING })
      .execute();

    jobRequest.status = JobRequestStatus.ACCEPTED;
    jobRequest.acceptedQuoteId = quote.id;
    await this.jobRequestRepository.save(jobRequest);

    const providerService = await this.providerServiceRepository.findOne({
      where: {
        provider: { id: quote.provider.id },
        category: { id: jobRequest.category.id },
        isActive: true,
      },
    });

    const serviceAmount = Number(quote.amount);

    const booking = this.bookingRepository.create({
      customer: jobRequest.customer,
      provider: quote.provider,
      providerService: providerService ?? undefined,
      quote: quote,
      pricingModel: PricingModel.QUOTE_BASED,
      scheduledDate: jobRequest.preferredDate ?? new Date(),
      description: jobRequest.description,
      estimatedHours: quote.estimatedHours ?? undefined,
      totalAmount: serviceAmount,
      status: BookingStatus.REQUESTED,
    });

    const savedBooking = await this.bookingRepository.save(booking);

    // Calculate convenience fee with optional promo code
    const feeResult = await this.platformFeesService.getConvenienceFee(
      serviceAmount,
      promoCode,
      userId,
    );
    // Calculate GST on (service amount + convenience fee)
    const gstRate = parseFloat(process.env.GST_RATE || '0.18');
    const gstAmount =
      Math.round((serviceAmount + feeResult.finalFee) * gstRate * 100) / 100;

    savedBooking.totalAmount = serviceAmount + feeResult.finalFee + gstAmount;
    savedBooking.convenienceFee = feeResult.finalFee;
    savedBooking.gstAmount = gstAmount;
    await this.bookingRepository.save(savedBooking);

    // Send role-specific booking confirmation messages to the chat
    const providerName =
      `${quote.provider.firstName || ''} ${quote.provider.lastName || ''}`.trim();
    const customerName =
      `${jobRequest.customer.firstName || ''} ${jobRequest.customer.lastName || ''}`.trim();
    const customerUserId = userId;
    const providerUserId = quote.provider.user.id;

    const confirmationTemplates = getBookingConfirmationMessages(
      providerName,
      customerName,
      serviceAmount,
    );

    this.chatGateway
      .emitRoleSpecificSystemMessage(
        savedBooking.id,
        customerUserId,
        providerUserId,
        confirmationTemplates.customer,
        confirmationTemplates.provider,
        { type: 'booking_confirmation', quoteAmount: serviceAmount },
      )
      .catch((err) => {
        this.logger.warn(
          `Failed to emit booking confirmation messages: ${(err as Error).message}`,
        );
      });

    return this.bookingRepository.findOne({
      where: { id: savedBooking.id },
      relations: {
        customer: { user: true },
        provider: { user: true },
        providerService: { category: true },
        charges: true,
      },
    });
  }

  private async chargeLeadQuoteFee(
    provider: Provider,
    quote: Quote,
  ): Promise<void> {
    const feeResult = await this.platformFeesService.calculateLeadQuoteFee(
      Number(quote.amount),
      provider.id,
    );
    if (feeResult.finalFee > 0) {
      this.logger.log(
        `Lead quote fee of ₹${feeResult.finalFee} applicable for provider ${provider.id} on quote ${quote.id}`,
      );
      // Fee is tracked; actual deduction can be done via wallet or invoiced later
    }
  }
}
