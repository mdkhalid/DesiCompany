import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateDisputeDto, userId: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id: dto.bookingId },
      relations: { customer: { user: true }, provider: { user: true } },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Only customer or provider involved in the booking can raise a dispute
    const isCustomer = booking.customer?.user?.id === userId;
    const isProvider = booking.provider?.user?.id === userId;
    if (!isCustomer && !isProvider) {
      throw new ForbiddenException(
        'Only the customer or provider involved can raise a dispute',
      );
    }

    // Check for existing open dispute on this booking
    const existing = await this.disputeRepository.findOne({
      where: {
        booking: { id: dto.bookingId },
        status: DisputeStatus.OPEN,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'An open dispute already exists for this booking',
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const dispute = this.disputeRepository.create({
      booking,
      raisedBy: user,
      reason: dto.reason,
    });
    return this.disputeRepository.save(dispute);
  }

  async findAll() {
    return this.disputeRepository.find({
      relations: {
        booking: true,
        raisedBy: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const dispute = await this.disputeRepository.findOne({
      where: { id },
      relations: {
        booking: { customer: { user: true }, provider: { user: true } },
        raisedBy: true,
      },
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }
    return dispute;
  }

  async resolve(id: string, dto: ResolveDisputeDto) {
    const dispute = await this.disputeRepository.findOne({
      where: { id },
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (
      dispute.status === DisputeStatus.RESOLVED ||
      dispute.status === DisputeStatus.DISMISSED
    ) {
      throw new BadRequestException('Dispute is already closed');
    }

    dispute.status = dto.status;
    dispute.resolution = dto.resolution;
    dispute.resolvedAt = new Date();

    return this.disputeRepository.save(dispute);
  }
}
