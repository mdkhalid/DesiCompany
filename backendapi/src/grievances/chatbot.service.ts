import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Grievance,
  GrievanceCategory,
  GrievanceStatus,
  GrievancePriority,
  ResolutionType,
} from './entities/grievance.entity';
import { GrievanceMessage, MessageSender } from './entities/grievance-message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';

// Configurable deadline in days
const GRIEVANCE_DEADLINE_DAYS = 10;

export interface BotResponse {
  message: string;
  options?: string[];
  isEscalated?: boolean;
  resolution?: ResolutionType;
  isExpired?: boolean;
}

const CATEGORY_LABELS: Record<GrievanceCategory, string> = {
  [GrievanceCategory.SERVICE_QUALITY]: 'Service Quality Issue',
  [GrievanceCategory.DELAY_NO_SHOW]: 'Delay / No-show',
  [GrievanceCategory.BILLING_OVERCHARGE]: 'Billing / Overcharge',
  [GrievanceCategory.DAMAGED_PROPERTY]: 'Damaged Property',
  [GrievanceCategory.RUDE_BEHAVIOR]: 'Rude Behavior',
  [GrievanceCategory.INCOMPLETE_WORK]: 'Incomplete Work',
  [GrievanceCategory.WRONG_SERVICE]: 'Wrong Service',
  [GrievanceCategory.OTHER]: 'Other Issue',
};

const CATEGORY_QUESTIONS: Record<GrievanceCategory, string[]> = {
  [GrievanceCategory.SERVICE_QUALITY]: [
    'Could you describe the quality issue you experienced?',
    'Did the provider complete the work as agreed?',
    'Would you like us to reschedule with the same or different provider?',
  ],
  [GrievanceCategory.DELAY_NO_SHOW]: [
    'How long was the delay?',
    'Did the provider inform you about the delay?',
    'Would you like to reschedule the service?',
  ],
  [GrievanceCategory.BILLING_OVERCHARGE]: [
    'What was the agreed price?',
    'What amount were you charged?',
    'Please describe the discrepancy.',
  ],
  [GrievanceCategory.DAMAGED_PROPERTY]: [
    'What property was damaged?',
    'Please describe the extent of damage.',
    'Do you have photos of the damage?',
  ],
  [GrievanceCategory.RUDE_BEHAVIOR]: [
    'Please describe the behavior you experienced.',
    'When did this occur during the service?',
  ],
  [GrievanceCategory.INCOMPLETE_WORK]: [
    'What part of the work was not completed?',
    'Did you inform the provider about the incomplete work?',
  ],
  [GrievanceCategory.WRONG_SERVICE]: [
    'What service did you request?',
    'What service was actually provided?',
  ],
  [GrievanceCategory.OTHER]: [
    'Please describe your issue in detail.',
  ],
};

@Injectable()
export class ChatbotService {
  constructor(
    @InjectRepository(Grievance)
    private readonly grievanceRepository: Repository<Grievance>,
    @InjectRepository(GrievanceMessage)
    private readonly messageRepository: Repository<GrievanceMessage>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async startGrievance(bookingId: string, customerId: string): Promise<Grievance> {
    // Verify booking exists and belongs to customer
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: {
        customer: true,
        provider: true,
        providerService: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customer?.id !== customerId) {
      throw new BadRequestException('This booking does not belong to you');
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      throw new BadRequestException('You can only raise grievances for completed bookings');
    }

    // Check if grievance deadline has passed
    const bookingDate = new Date(booking.updatedAt || booking.createdAt);
    const now = new Date();
    const daysSinceBooking = Math.floor((now.getTime() - bookingDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceBooking > GRIEVANCE_DEADLINE_DAYS) {
      throw new BadRequestException(
        `Grievance window has expired. You can only raise issues within ${GRIEVANCE_DEADLINE_DAYS} days of service completion.`
      );
    }

    // Check if grievance already exists for this booking
    const existing = await this.grievanceRepository.findOne({
      where: { booking: { id: bookingId } },
    });

    if (existing) {
      return existing;
    }

    // Create new grievance
    const grievance = this.grievanceRepository.create({
      booking,
      customer: { id: customerId } as User,
      category: GrievanceCategory.OTHER,
      status: GrievanceStatus.OPEN,
      priority: GrievancePriority.MEDIUM,
    });

    const saved = await this.grievanceRepository.save(grievance);

    // Calculate remaining days for message
    const remainingDays = GRIEVANCE_DEADLINE_DAYS - daysSinceBooking;

    // Send initial bot message
    await this.addMessage(saved.id, MessageSender.BOT, 
      `Hello! I'm here to help you with your booking #${bookingId.slice(0, 8)}. ` +
      `Please note: You have ${remainingDays} days remaining to raise a complaint for this booking.\n\n` +
      `Please select the type of issue you're experiencing:`,
      {
        options: Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
          value: key,
          label,
        })),
        remainingDays,
        deadlineDays: GRIEVANCE_DEADLINE_DAYS,
      }
    );

    return saved;
  }

  async checkGrievanceEligibility(bookingId: string): Promise<{
    eligible: boolean;
    reason?: string;
    remainingDays?: number;
    deadlineDays: number;
  }> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
    });

    if (!booking) {
      return { eligible: false, reason: 'Booking not found', deadlineDays: GRIEVANCE_DEADLINE_DAYS };
    }

    if (booking.status !== 'completed') {
      return { eligible: false, reason: 'Booking is not completed yet', deadlineDays: GRIEVANCE_DEADLINE_DAYS };
    }

    const bookingDate = new Date(booking.updatedAt || booking.createdAt);
    const now = new Date();
    const daysSinceBooking = Math.floor((now.getTime() - bookingDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceBooking > GRIEVANCE_DEADLINE_DAYS) {
      return {
        eligible: false,
        reason: `Grievance window expired ${daysSinceBooking - GRIEVANCE_DEADLINE_DAYS} days ago`,
        deadlineDays: GRIEVANCE_DEADLINE_DAYS,
      };
    }

    // Check if grievance already exists
    const existing = await this.grievanceRepository.findOne({
      where: { booking: { id: bookingId } },
    });

    if (existing) {
      return {
        eligible: false,
        reason: 'A grievance already exists for this booking',
        deadlineDays: GRIEVANCE_DEADLINE_DAYS,
      };
    }

    return {
      eligible: true,
      remainingDays: GRIEVANCE_DEADLINE_DAYS - daysSinceBooking,
      deadlineDays: GRIEVANCE_DEADLINE_DAYS,
    };
  }

  async getGrievance(grievanceId: string): Promise<Grievance> {
    const grievance = await this.grievanceRepository.findOne({
      where: { id: grievanceId },
      relations: {
        booking: { provider: { user: true } },
        customer: true,
        messages: true,
      },
    });

    if (!grievance) {
      throw new NotFoundException('Grievance not found');
    }

    return grievance;
  }

  async getGrievanceByBooking(bookingId: string): Promise<Grievance | null> {
    return this.grievanceRepository.findOne({
      where: { booking: { id: bookingId } },
      relations: { messages: true },
    });
  }

  async getCustomerGrievances(customerId: string): Promise<Grievance[]> {
    return this.grievanceRepository.find({
      where: { customer: { id: customerId } },
      relations: { booking: true, messages: true },
      order: { createdAt: 'DESC' },
    });
  }

  async processMessage(grievanceId: string, customerMessage: string): Promise<BotResponse> {
    const grievance = await this.getGrievance(grievanceId);

    // Save customer message
    await this.addMessage(grievanceId, MessageSender.CUSTOMER, customerMessage);

    // Check if this is a category selection
    const categoryKeys = Object.values(GrievanceCategory);
    if (categoryKeys.includes(customerMessage as GrievanceCategory)) {
      return this.handleCategorySelection(grievance, customerMessage as GrievanceCategory);
    }

    // Process based on current state
    if (grievance.status === GrievanceStatus.OPEN) {
      return this.handleOpenState(grievance, customerMessage);
    }

    if (grievance.status === GrievanceStatus.IN_PROGRESS) {
      return this.handleInProgressState(grievance, customerMessage);
    }

    // If escalated or resolved, just acknowledge
    return {
      message: 'Your grievance is being reviewed by our team. An admin will contact you shortly.',
    };
  }

  private async handleCategorySelection(grievance: Grievance, category: GrievanceCategory): Promise<BotResponse> {
    // Update grievance category
    grievance.category = category;
    grievance.status = GrievanceStatus.IN_PROGRESS;

    // Set priority based on category
    if ([GrievanceCategory.DAMAGED_PROPERTY, GrievanceCategory.RUDE_BEHAVIOR].includes(category)) {
      grievance.priority = GrievancePriority.HIGH;
    } else if (category === GrievanceCategory.DELAY_NO_SHOW) {
      grievance.priority = GrievancePriority.MEDIUM;
    }

    await this.grievanceRepository.save(grievance);

    // Ask first follow-up question
    const questions = CATEGORY_QUESTIONS[category];
    await this.addMessage(grievance.id, MessageSender.BOT, questions[0]);

    return {
      message: questions[0],
    };
  }

  private async handleOpenState(grievance: Grievance, message: string): Promise<BotResponse> {
    // If no category selected yet, ask for it
    await this.addMessage(grievance.id, MessageSender.BOT, 
      'Please select the type of issue from the options above.',
    );

    return {
      message: 'Please select the type of issue from the options above.',
    };
  }

  private async handleInProgressState(grievance: Grievance, message: string): Promise<BotResponse> {
    const questions = CATEGORY_QUESTIONS[grievance.category];
    const messageCount = grievance.messages.filter(m => m.sender === MessageSender.CUSTOMER).length;

    // Collect answers until we have enough info
    if (messageCount < questions.length) {
      const nextQuestion = questions[messageCount];
      await this.addMessage(grievance.id, MessageSender.BOT, nextQuestion);
      return { message: nextQuestion };
    }

    // We have enough info, try to resolve
    return this.attemptResolution(grievance, message);
  }

  private async attemptResolution(grievance: Grievance, lastMessage: string): Promise<BotResponse> {
    const category = grievance.category;

    // Auto-resolution logic based on category
    switch (category) {
      case GrievanceCategory.DELAY_NO_SHOW:
        return this.offerReschedule(grievance);

      case GrievanceCategory.SERVICE_QUALITY:
      case GrievanceCategory.INCOMPLETE_WORK:
        return this.offerRescheduleOrEscalate(grievance);

      case GrievanceCategory.BILLING_OVERCHARGE:
      case GrievanceCategory.DAMAGED_PROPERTY:
        return this.escalateToAdmin(grievance, 'Requires refund review by admin');

      case GrievanceCategory.RUDE_BEHAVIOR:
        return this.escalateToAdmin(grievance, 'Behavioral complaint requires admin review');

      default:
        return this.offerCouponOrEscalate(grievance);
    }
  }

  private async offerReschedule(grievance: Grievance): Promise<BotResponse> {
    const response: BotResponse = {
      message: 'I understand you experienced a delay. Would you like me to reschedule your service?',
      options: ['Yes, reschedule', 'No, I want to speak to an admin'],
    };

    await this.addMessage(grievance.id, MessageSender.BOT, response.message, {
      options: response.options,
    });

    return response;
  }

  private async offerRescheduleOrEscalate(grievance: Grievance): Promise<BotResponse> {
    const response: BotResponse = {
      message: 'I understand the service wasn\'t up to your expectations. I can offer you:',
      options: [
        'Reschedule with a different provider',
        'Get a discount coupon for next booking',
        'Speak to an admin for refund',
      ],
    };

    await this.addMessage(grievance.id, MessageSender.BOT, response.message, {
      options: response.options,
    });

    return response;
  }

  private async offerCouponOrEscalate(grievance: Grievance): Promise<BotResponse> {
    const response: BotResponse = {
      message: 'I apologize for the inconvenience. I can offer:',
      options: [
        'Get a 15% discount coupon',
        'Speak to an admin',
      ],
    };

    await this.addMessage(grievance.id, MessageSender.BOT, response.message, {
      options: response.options,
    });

    return response;
  }

  private async escalateToAdmin(grievance: Grievance, reason: string): Promise<BotResponse> {
    grievance.status = GrievanceStatus.ESCALATED;
    grievance.resolutionType = ResolutionType.ESCALATED_TO_ADMIN;
    await this.grievanceRepository.save(grievance);

    const message = `I'm escalating your case to our admin team. ${reason}. ` +
      'An admin will review your case and may contact you. You can check the status here.';

    await this.addMessage(grievance.id, MessageSender.BOT, message);
    await this.addMessage(grievance.id, MessageSender.SYSTEM, 'Grievance escalated to admin', {
      action: 'escalated',
    });

    return {
      message,
      isEscalated: true,
      resolution: ResolutionType.ESCALATED_TO_ADMIN,
    };
  }

  async handleOptionSelection(grievanceId: string, option: string): Promise<BotResponse> {
    const grievance = await this.getGrievance(grievanceId);

    await this.addMessage(grievanceId, MessageSender.CUSTOMER, option);

    // Handle reschedule option
    if (option.includes('reschedule') || option.includes('Reschedule')) {
      return this.processReschedule(grievance);
    }

    // Handle coupon option
    if (option.includes('discount') || option.includes('coupon')) {
      return this.processCoupon(grievance);
    }

    // Handle escalate to admin
    if (option.includes('admin') || option.includes('refund')) {
      return this.escalateToAdmin(grievance, 'Customer requested admin assistance');
    }

    return {
      message: 'Thank you for your response. How else can I help you?',
    };
  }

  private async processReschedule(grievance: Grievance): Promise<BotResponse> {
    // Mark for reschedule
    grievance.resolutionType = ResolutionType.AUTO_RESCHEDULE;
    grievance.resolutionDetails = 'Auto-reschedule approved by chatbot';
    grievance.status = GrievanceStatus.RESOLVED;
    grievance.resolvedAt = new Date();
    await this.grievanceRepository.save(grievance);

    const message = 'Your reschedule request has been approved! ' +
      'You can book a new service anytime. Your next booking will have priority scheduling.';

    await this.addMessage(grievance.id, MessageSender.BOT, message);

    return {
      message,
      resolution: ResolutionType.AUTO_RESCHEDULE,
    };
  }

  private async processCoupon(grievance: Grievance): Promise<BotResponse> {
    // Generate coupon
    const couponCode = `GRV${Date.now().toString(36).toUpperCase()}`;
    
    grievance.resolutionType = ResolutionType.DISCOUNT_COUPON;
    grievance.couponCode = couponCode;
    grievance.resolutionDetails = '15% discount coupon issued';
    grievance.status = GrievanceStatus.RESOLVED;
    grievance.resolvedAt = new Date();
    await this.grievanceRepository.save(grievance);

    const message = `Great news! I've generated a 15% discount coupon for your next booking.\n\n` +
      `Your coupon code: **${couponCode}**\n\n` +
      'This coupon is valid for 30 days. Thank you for your patience!';

    await this.addMessage(grievance.id, MessageSender.BOT, message);

    return {
      message,
      resolution: ResolutionType.DISCOUNT_COUPON,
    };
  }

  private async addMessage(
    grievanceId: string,
    sender: MessageSender,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<GrievanceMessage> {
    const message = this.messageRepository.create({
      grievance: { id: grievanceId } as Grievance,
      sender,
      content,
      metadata,
    });
    return this.messageRepository.save(message);
  }

  getCategories(): Array<{ value: string; label: string }> {
    return Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
      value: key,
      label,
    }));
  }
}
