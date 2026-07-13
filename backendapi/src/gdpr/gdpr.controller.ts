import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from '../users/users.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Message } from '../chat/entities/message.entity';
import { DirectMessage } from '../chat/entities/direct-message.entity';
import { ActivityLog } from '../activity-logs/entities/activity-log.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { CustomerFeedback } from '../feedbacks/entities/customer-feedback.entity';
import { KycDocument } from '../kyc/entities/kyc-document.entity';

interface AuthenticatedRequest {
  user: { id: string; role: UserRole };
}

@Controller('gdpr')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.PROVIDER)
export class GdprController {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(DirectMessage)
    private readonly directMessageRepository: Repository<DirectMessage>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
    @InjectRepository(CustomerFeedback)
    private readonly feedbackRepository: Repository<CustomerFeedback>,
    @InjectRepository(KycDocument)
    private readonly kycRepository: Repository<KycDocument>,
  ) {}

  @Get('export')
  async exportData(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;

    const [profile, bookings, payments, reviews, notifications] =
      await Promise.all([
        this.usersService.getProfile(userId),
        this.bookingRepository.find({
          where: [{ customer: { id: userId } }, { provider: { id: userId } }],
          relations: {
            customer: { user: true },
            provider: { user: true },
            quote: true,
          },
        }),
        this.paymentRepository.find({
          where: [
            { booking: { customer: { id: userId } } },
            { booking: { provider: { id: userId } } },
          ],
          relations: { booking: { customer: true, provider: true } },
          take: 500,
        }),
        this.reviewRepository.find({
          where: [{ customer: { id: userId } }, { provider: { id: userId } }],
          relations: {
            customer: { user: true },
            provider: { user: true },
            booking: true,
          },
        }),
        this.notificationRepository.find({
          where: { user: { id: userId } },
          order: { createdAt: 'DESC' },
          take: 500,
        }),
      ]);

    const [messages, dms, disputes, feedback, kyc, activity] =
      await Promise.all([
        this.messageRepository.find({
          where: { sender: { id: userId } },
          take: 500,
        }),
        this.directMessageRepository.find({
          where: { sender: { id: userId } },
          take: 500,
        }),
        this.disputeRepository.find({
          where: { raisedBy: { id: userId } },
          relations: { booking: true },
        }),
        this.feedbackRepository.find({
          where: [{ customer: { id: userId } }, { provider: { id: userId } }],
          relations: { customer: true, provider: true, booking: true },
        }),
        this.kycRepository.find({
          where: { provider: { user: { id: userId } } },
          relations: { provider: { user: true } },
        }),
        this.activityLogRepository.find({
          where: { actor: { id: userId } },
          take: 500,
        }),
      ]);

    const sanitizedProfile = this.usersService.sanitizeForExport(profile);

    return {
      exportedAt: new Date().toISOString(),
      userId,
      profile: sanitizedProfile,
      bookings,
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        status: p.status,
        createdAt: p.createdAt,
        bookingId: p.booking?.id,
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        bookingId: r.booking?.id,
      })),
      notifications,
      messages,
      directMessages: dms,
      disputes,
      feedback,
      kycDocuments: kyc.map((k) => ({
        id: k.id,
        documentType: k.documentType,
        status: k.status,
        submittedAt: k.createdAt,
      })),
      activityLogs: activity,
    };
  }

  @Get('delete-request')
  async deleteRequest(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;

    await this.usersService.anonymizeUser(userId);

    return {
      status: 'anonymized',
      message: 'Your personal data has been anonymized as requested.',
    };
  }
}
