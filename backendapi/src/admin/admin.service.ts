import { Injectable } from '@nestjs/common';
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
}
