import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Customer } from './entities/customer.entity';
import { Provider } from './entities/provider.entity';
import { UserStatus } from '../common/enums/user-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async getProfile(userId: string) {
    let user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { customer: true, provider: true },
    });

    if (!user) {
      const provider = await this.providerRepository.findOne({
        where: { id: userId },
        relations: { user: { customer: true, provider: true } },
      });
      if (provider?.user) {
        user = provider.user;
      }
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Always query provider and customer directly by userId for reliability
    const [provider, customer] = await Promise.all([
      this.providerRepository.findOne({
        where: { user: { id: userId } },
      }),
      this.customerRepository.findOne({
        where: { user: { id: userId } },
      }),
    ]);

    const providerId = provider?.id ?? user.provider?.id ?? null;
    const customerId = customer?.id ?? user.customer?.id ?? null;

    // Defensive fix: if user has provider in roles but no provider entity, create it
    if (!providerId && user.roles?.includes(UserRole.PROVIDER)) {
      const newProvider = this.providerRepository.create({
        user,
        firstName: user.customer?.firstName || '',
        lastName: user.customer?.lastName || undefined,
      });
      const saved = await this.providerRepository.save(newProvider);
      user.provider = saved;
    }

    // Defensive fix: if user has customer in roles but no customer entity, create it
    if (!customerId && user.roles?.includes(UserRole.CUSTOMER)) {
      const newCustomer = this.customerRepository.create({
        user,
        firstName: user.provider?.firstName || '',
        lastName: user.provider?.lastName || undefined,
      });
      const saved = await this.customerRepository.save(newCustomer);
      user.customer = saved;
    }

    const finalProviderId = user.provider?.id ?? providerId;
    const finalCustomerId = user.customer?.id ?? customerId;

    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      roles: user.roles,
      status: user.status,
      profileImage: user.profileImage,
      language: user.language,
      fcmToken: user.fcmToken,
      suspendedAt: user.suspendedAt,
      suspendedBy: user.suspendedBy,
      suspensionReason: user.suspensionReason,
      customerId: finalCustomerId,
      customer: user.customer ?? customer ?? null,
      providerId: finalProviderId,
      provider: user.provider ?? provider ?? null,
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { customer: true, provider: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateProfileDto.email !== undefined) {
      user.email = updateProfileDto.email;
    }
    if (updateProfileDto.profileImage !== undefined) {
      user.profileImage = updateProfileDto.profileImage;
    }
    if (updateProfileDto.language !== undefined) {
      user.language = updateProfileDto.language;
    }

    await this.userRepository.save(user);

    if (user.customer) {
      if (updateProfileDto.firstName !== undefined)
        user.customer.firstName = updateProfileDto.firstName;
      if (updateProfileDto.lastName !== undefined)
        user.customer.lastName = updateProfileDto.lastName;
      if (updateProfileDto.address !== undefined)
        user.customer.address = updateProfileDto.address;
      if (updateProfileDto.locality !== undefined)
        user.customer.locality = updateProfileDto.locality;
      if (updateProfileDto.landmark !== undefined)
        user.customer.landmark = updateProfileDto.landmark;
      if (updateProfileDto.city !== undefined)
        user.customer.city = updateProfileDto.city;
      if (updateProfileDto.state !== undefined)
        user.customer.state = updateProfileDto.state;
      if (updateProfileDto.pincode !== undefined)
        user.customer.pincode = updateProfileDto.pincode;
      if (updateProfileDto.latitude !== undefined)
        user.customer.latitude = updateProfileDto.latitude;
      if (updateProfileDto.longitude !== undefined)
        user.customer.longitude = updateProfileDto.longitude;
      await this.customerRepository.save(user.customer);
    }

    if (user.provider) {
      if (updateProfileDto.firstName !== undefined)
        user.provider.firstName = updateProfileDto.firstName;
      if (updateProfileDto.lastName !== undefined)
        user.provider.lastName = updateProfileDto.lastName;
      if (updateProfileDto.address !== undefined)
        user.provider.address = updateProfileDto.address;
      if (updateProfileDto.locality !== undefined)
        user.provider.locality = updateProfileDto.locality;
      if (updateProfileDto.landmark !== undefined)
        user.provider.landmark = updateProfileDto.landmark;
      if (updateProfileDto.city !== undefined)
        user.provider.city = updateProfileDto.city;
      if (updateProfileDto.state !== undefined)
        user.provider.state = updateProfileDto.state;
      if (updateProfileDto.pincode !== undefined)
        user.provider.pincode = updateProfileDto.pincode;
      if (updateProfileDto.latitude !== undefined)
        user.provider.latitude = updateProfileDto.latitude;
      if (updateProfileDto.longitude !== undefined)
        user.provider.longitude = updateProfileDto.longitude;
      if (updateProfileDto.serviceRadiusKm !== undefined)
        user.provider.serviceRadiusKm = updateProfileDto.serviceRadiusKm;
      await this.providerRepository.save(user.provider);
    }

    return this.getProfile(userId);
  }

  async findAll() {
    return this.userRepository.find({
      relations: {
        customer: true,
        provider: {
          services: { category: true },
        },
      },
    });
  }

  async findOne(id: string) {
    let user = await this.userRepository.findOne({
      where: { id },
      relations: {
        customer: true,
        provider: {
          services: { category: true },
        },
      },
    });

    if (!user) {
      const provider = await this.providerRepository.findOne({
        where: { id },
        relations: { user: true },
      });
      if (provider?.user) {
        user = provider.user;
      }
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateStatus(id: string, status: UserStatus) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = status;
    return this.userRepository.save(user);
  }

  sanitizeForExport(profile: Record<string, unknown>) {
    const sensitiveKeys = new Set([
      'password',
      'fcmToken',
      'token',
      'accessToken',
      'refreshToken',
    ]);
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(profile)) {
      if (sensitiveKeys.has(key)) continue;
      sanitized[key] = value;
    }
    return sanitized;
  }

  async anonymizeUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { customer: true, provider: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const anonymisedId = `anon_${user.id.slice(-8)}`;
    user.email = `${anonymisedId}@deleted.local`;
    user.phone = `0000000000`;
    user.fcmToken = undefined;
    user.profileImage = '';
    await this.userRepository.save(user);

    if (user.customer) {
      user.customer.firstName = 'Deleted';
      user.customer.lastName = 'User';
      user.customer.address = '';
      user.customer.locality = '';
      user.customer.landmark = '';
      user.customer.city = '';
      user.customer.state = '';
      user.customer.pincode = '';
      user.customer.latitude = 0;
      user.customer.longitude = 0;
      await this.customerRepository.save(user.customer);
    }

    if (user.provider) {
      user.provider.firstName = 'Deleted';
      user.provider.lastName = 'User';
      user.provider.bio = '';
      user.provider.address = '';
      user.provider.locality = '';
      user.provider.landmark = '';
      user.provider.city = '';
      user.provider.state = '';
      user.provider.pincode = '';
      user.provider.latitude = 0;
      user.provider.longitude = 0;
      await this.providerRepository.save(user.provider);
    }

    await this.activityLogsService.log(
      'gdpr.anonymized',
      'User',
      user.id,
      user.id,
      { reason: 'user_request' },
    );
  }
}
