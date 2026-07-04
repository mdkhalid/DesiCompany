import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Customer } from './entities/customer.entity';
import { Provider } from './entities/provider.entity';
import { UserStatus } from '../common/enums/user-status.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { customer: true, provider: true },
    });

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

    // Debug log
    // eslint-disable-next-line no-console
    console.log('[getProfile]', {
      userId,
      phone: user.phone,
      role: user.role,
      roles: user.roles,
      userProvider: user.provider?.id ?? 'null',
      userCustomer: user.customer?.id ?? 'null',
      directProvider: provider?.id ?? 'null',
      directCustomer: customer?.id ?? 'null',
      providerId,
      customerId,
    });

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
      customerId,
      providerId,
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
    const user = await this.userRepository.findOne({
      where: { id },
      relations: {
        customer: true,
        provider: {
          services: { category: true },
        },
      },
    });

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
}
