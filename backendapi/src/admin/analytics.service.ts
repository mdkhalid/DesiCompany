import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { User } from '../users/entities/user.entity';
import { Provider } from '../users/entities/provider.entity';
import { Review } from '../reviews/entities/review.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async getDashboardAnalytics(range?: string): Promise<{
    overview: {
      totalBookings: number;
      todayBookings: number;
      weekBookings: number;
      monthBookings: number;
      totalUsers: number;
      totalProviders: number;
      totalCustomers: number;
      totalRevenue: number;
      monthRevenue: number;
      averageRating: number;
    };
    recentBookings: Booking[];
    topProviders: Provider[];
    bookingsByStatus: Record<string, number>;
    dailyBookingsTrend: Record<string, unknown>[];
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today);
    thisWeek.setDate(today.getDate() - today.getDay());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalBookings,
      todayBookings,
      weekBookings,
      monthBookings,
      totalUsers,
      totalProviders,
      totalCustomers,
      totalRevenue,
      monthRevenue,
      averageRating,
      recentBookings,
      topProviders,
      bookingsByStatus,
      dailyBookingsTrend,
    ] = await Promise.all([
      this.bookingRepository.count(),
      this.bookingRepository.count({
        where: { createdAt: MoreThanOrEqual(today) },
      }),
      this.bookingRepository.count({
        where: { createdAt: MoreThanOrEqual(thisWeek) },
      }),
      this.bookingRepository.count({
        where: { createdAt: MoreThanOrEqual(thisMonth) },
      }),
      this.userRepository.count(),
      this.providerRepository.count(),
      this.userRepository.count({ where: { role: UserRole.CUSTOMER } }),
      this.getTotalRevenue(),
      this.getMonthRevenue(thisMonth),
      this.getAverageRating(),
      this.getRecentBookings(10),
      this.getTopProviders(5),
      this.getBookingsByStatus(),
      this.getDailyBookingsTrend(range === '90d' ? 90 : range === '7d' ? 7 : 30),
    ]);

    return {
      overview: {
        totalBookings,
        todayBookings,
        weekBookings,
        monthBookings,
        totalUsers,
        totalProviders,
        totalCustomers,
        totalRevenue,
        monthRevenue,
        averageRating: Number(averageRating) || 0,
      },
      recentBookings,
      topProviders,
      bookingsByStatus,
      dailyBookingsTrend,
    };
  }

  async getRevenueAnalytics(startDate?: string, endDate?: string) {
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const dailyRevenue: { date: string; revenue: string }[] =
      await this.transactionRepository
        .createQueryBuilder('transaction')
        .select('DATE(transaction.created_at)', 'date')
        .addSelect('SUM(transaction.amount)', 'revenue')
        .where('transaction.created_at BETWEEN :start AND :end', { start, end })
        .andWhere("transaction.type = 'payment'")
        .groupBy('DATE(transaction.created_at)')
        .orderBy('date', 'ASC')
        .getRawMany();

    const totalRevenue = dailyRevenue.reduce(
      (sum, row) => sum + Number(row.revenue),
      0,
    );

    return {
      totalRevenue,
      dailyRevenue,
      period: { startDate: start, endDate: end },
    };
  }

  async getProviderAnalytics() {
    const topByBookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoin('booking.provider', 'provider')
      .select('provider.id', 'id')
      .addSelect('provider.firstName', 'firstName')
      .addSelect('provider.lastName', 'lastName')
      .addSelect('COUNT(booking.id)', 'totalBookings')
      .addSelect('AVG(booking.totalAmount)', 'averageBookingValue')
      .groupBy('provider.id')
      .addGroupBy('provider.firstName')
      .addGroupBy('provider.lastName')
      .orderBy('totalBookings', 'DESC')
      .limit(10)
      .getRawMany();

    const topByRating = await this.providerRepository
      .createQueryBuilder('provider')
      .select([
        'provider.id',
        'provider.firstName',
        'provider.lastName',
        'provider.averageRating',
        'provider.totalReviews',
      ])
      .where('provider.totalReviews > 0')
      .orderBy('provider.averageRating', 'DESC')
      .limit(10)
      .getMany();

    return {
      topByBookings,
      topByRating,
    };
  }

  async getCategoryAnalytics() {
    const categoryStats = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoin('booking.providerService', 'service')
      .leftJoin('service.category', 'category')
      .select('category.id', 'id')
      .addSelect('category.nameEn', 'name')
      .addSelect('COUNT(booking.id)', 'totalBookings')
      .addSelect('SUM(booking.totalAmount)', 'totalRevenue')
      .addSelect('AVG(booking.totalAmount)', 'averageBookingValue')
      .groupBy('category.id')
      .addGroupBy('category.nameEn')
      .orderBy('totalBookings', 'DESC')
      .getRawMany();

    return { categoryStats };
  }

  private async getTotalRevenue(): Promise<number> {
    const result: Record<string, unknown> | undefined =
      await this.transactionRepository
        .createQueryBuilder('transaction')
        .select('SUM(transaction.amount)', 'total')
        .where("transaction.type = 'payment'")
        .getRawOne();
    return Number(result?.total || 0);
  }

  private async getMonthRevenue(startDate: Date): Promise<number> {
    const result: Record<string, unknown> | undefined =
      await this.transactionRepository
        .createQueryBuilder('transaction')
        .select('SUM(transaction.amount)', 'total')
        .where("transaction.type = 'payment'")
        .andWhere('transaction.created_at >= :startDate', { startDate })
        .getRawOne();
    return Number(result?.total || 0);
  }

  private async getAverageRating(): Promise<number> {
    const result: Record<string, unknown> | undefined =
      await this.reviewRepository
        .createQueryBuilder('review')
        .select('AVG(review.rating)', 'average')
        .getRawOne();
    return Number(result?.average || 0);
  }

  private async getRecentBookings(limit: number): Promise<Booking[]> {
    return this.bookingRepository.find({
      relations: {
        customer: { user: true },
        provider: { user: true },
        providerService: { category: true },
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  private async getTopProviders(limit: number): Promise<Provider[]> {
    return this.providerRepository.find({
      where: { isVerified: true },
      order: { averageRating: 'DESC', totalReviews: 'DESC' },
      take: limit,
      relations: { user: true },
    });
  }

  private async getBookingsByStatus(): Promise<Record<string, number>> {
    const result: Record<string, unknown>[] = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('booking.status', 'status')
      .addSelect('COUNT(booking.id)', 'count')
      .groupBy('booking.status')
      .getRawMany();

    return result.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.status)] = Number(row.count);
      return acc;
    }, {});
  }

  private async getDailyBookingsTrend(
    days: number,
  ): Promise<Record<string, unknown>[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result: Record<string, unknown>[] = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('DATE(booking.created_at)', 'date')
      .addSelect('COUNT(booking.id)', 'count')
      .where('booking.created_at >= :startDate', { startDate })
      .groupBy('DATE(booking.created_at)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return result;
  }
}
