import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';
import { CommissionConfig } from '../commissions/entities/commission-config.entity';
import { UserStatus } from '../common/enums/user-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { CommissionType } from '../common/enums/commission-type.enum';
import { CreateAdminDto } from './dto/create-admin.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { SoftBlockService } from '../payments/soft-block.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(CommissionConfig)
    private readonly commissionConfigRepository: Repository<CommissionConfig>,
    private readonly softBlockService: SoftBlockService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async getDashboard() {
    const totalUsers = await this.userRepository.count();
    const totalCustomers = await this.customerRepository.count();
    const totalProviders = await this.providerRepository.count();
    const totalBookings = await this.bookingRepository.count();
    const totalPayments = await this.paymentRepository.count();
    const activeUsers = await this.userRepository.count({
      where: { status: UserStatus.ACTIVE },
    });

    return {
      totalUsers,
      totalCustomers,
      totalProviders,
      totalBookings,
      totalPayments,
      activeUsers,
    };
  }

  async findAllBookings() {
    return this.bookingRepository.find({
      relations: {
        customer: { user: true },
        provider: { user: true },
        providerService: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findAllCommissions() {
    return this.commissionConfigRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findAllReviews() {
    return this.reviewRepository.find({
      relations: {
        customer: { user: true },
        provider: { user: true },
        booking: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async createAdmin(dto: CreateAdminDto) {
    const existingUser = await this.userRepository.findOne({
      where: { phone: dto.phone },
    });
    if (existingUser) {
      throw new ConflictException('User with this phone already exists');
    }

    const user = this.userRepository.create({
      phone: dto.phone,
      email: dto.email,
      role: UserRole.ADMIN,
      roles: [UserRole.ADMIN],
      status: UserStatus.ACTIVE,
    });
    const savedUser = await this.userRepository.save(user);

    await this.activityLogsService.log(
      'admin.created',
      'User',
      savedUser.id,
    );

    return { user: savedUser };
  }

  async findUsers(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.customer', 'customer')
      .leftJoinAndSelect('user.provider', 'provider');

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }
    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        '(user.phone ILIKE :search OR user.email ILIKE :search OR customer.firstName ILIKE :search OR customer.lastName ILIKE :search OR provider.firstName ILIKE :search OR provider.lastName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const total = await qb.getCount();
    const users = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async suspendUser(userId: string, dto: SuspendUserDto, adminId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot suspend admin users');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new BadRequestException('User is already suspended');
    }

    user.status = UserStatus.SUSPENDED;
    user.suspendedAt = new Date();
    user.suspendedBy = adminId;
    user.suspensionReason = dto.reason;

    const saved = await this.userRepository.save(user);

    await this.activityLogsService.log(
      'user.suspended',
      'User',
      userId,
      adminId,
      { reason: dto.reason },
    );

    return saved;
  }

  async activateUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new BadRequestException('User is already active');
    }

    user.status = UserStatus.ACTIVE;
    user.suspendedAt = undefined;
    user.suspendedBy = undefined;
    user.suspensionReason = undefined;

    const saved = await this.userRepository.save(user);

    await this.activityLogsService.log(
      'user.activated',
      'User',
      userId,
    );

    return saved;
  }

  async unblockProvider(userId: string) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    if (!provider.isSoftBlocked) {
      throw new BadRequestException('Provider is not soft-blocked');
    }

    await this.softBlockService.unblockProvider(userId);

    return { message: 'Provider unblocked successfully' };
  }

  async deleteUser(userId: string, adminId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot delete admin users');
    }

    if (userId === adminId) {
      throw new BadRequestException('Cannot delete yourself');
    }

    if (user.status === UserStatus.DELETED) {
      throw new BadRequestException('User is already deleted');
    }

    user.status = UserStatus.DELETED;
    user.deletedAt = new Date();

    const saved = await this.userRepository.save(user);

    await this.activityLogsService.log(
      'user.deleted',
      'User',
      userId,
      adminId,
    );

    return saved;
  }

  async createCommissionConfig(dto: {
    scope: string;
    scopeId?: string;
    type: CommissionType;
    value: number;
  }) {
    const config = this.commissionConfigRepository.create({
      scope: dto.scope,
      scopeId: dto.scopeId,
      type: dto.type,
      value: dto.value,
    });
    return this.commissionConfigRepository.save(config);
  }

  async updateCommissionConfig(
    id: string,
    dto: {
      type?: CommissionType;
      value?: number;
      isActive?: boolean;
    },
  ) {
    const config = await this.commissionConfigRepository.findOne({
      where: { id },
    });
    if (!config) {
      throw new NotFoundException('Commission config not found');
    }

    if (dto.type !== undefined) config.type = dto.type;
    if (dto.value !== undefined) config.value = dto.value;
    if (dto.isActive !== undefined) config.isActive = dto.isActive;

    return this.commissionConfigRepository.save(config);
  }

  async deleteCommissionConfig(id: string) {
    const config = await this.commissionConfigRepository.findOne({
      where: { id },
    });
    if (!config) {
      throw new NotFoundException('Commission config not found');
    }
    await this.commissionConfigRepository.remove(config);
    return { message: 'Commission config deleted' };
  }
}
