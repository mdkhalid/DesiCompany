import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';

interface RegisterDto {
  phone: string;
  otp: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface LoginDto {
  phone: string;
  otp: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  sub: string;
  phone: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  private readonly otpStore = new Map<
    string,
    { code: string; expiresAt: Date }
  >();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    private readonly jwtService: JwtService,
  ) {}

  requestOtp(phone: string): { message: string } {
    const code =
      process.env.OTP_MOCK === 'true'
        ? process.env.OTP_MOCK_CODE || '123456'
        : this.generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    this.otpStore.set(phone, { code, expiresAt });

    // TODO: Integrate SMS provider here for production
    return { message: `OTP sent to ${phone}` };
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    // Validate OTP
    const otpRecord = this.otpStore.get(registerDto.phone);
    if (!otpRecord) {
      throw new BadRequestException('OTP not found or expired');
    }
    if (otpRecord.expiresAt < new Date()) {
      this.otpStore.delete(registerDto.phone);
      throw new BadRequestException('OTP expired');
    }
    if (otpRecord.code !== registerDto.otp) {
      throw new UnauthorizedException('Invalid OTP');
    }
    this.otpStore.delete(registerDto.phone);

    // Check if user already exists (first role vs adding second role)
    const existingUser = await this.userRepository.findOne({
      where: { phone: registerDto.phone },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // First-time registration (new user)
    const user = this.userRepository.create({
      phone: registerDto.phone,
      role: registerDto.role,
      roles: [registerDto.role],
      email: registerDto.email || undefined,
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.userRepository.save(user);

    if (registerDto.role === UserRole.CUSTOMER) {
      const customer = this.customerRepository.create({
        user: savedUser,
        firstName: registerDto.firstName || '',
        lastName: registerDto.lastName || undefined,
      });
      await this.customerRepository.save(customer);
    } else if (registerDto.role === UserRole.PROVIDER) {
      const provider = this.providerRepository.create({
        user: savedUser,
        firstName: registerDto.firstName || '',
        lastName: registerDto.lastName || undefined,
      });
      await this.providerRepository.save(provider);
    }

    const tokens = this.generateTokens(savedUser);
    return { user: savedUser, tokens };
  }

  async login(loginDto: LoginDto): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await this.userRepository.findOne({
      where: { phone: loginDto.phone },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    const otpRecord = this.otpStore.get(loginDto.phone);
    if (!otpRecord) {
      throw new BadRequestException('OTP not found or expired');
    }

    if (otpRecord.expiresAt < new Date()) {
      this.otpStore.delete(loginDto.phone);
      throw new BadRequestException('OTP expired');
    }

    if (otpRecord.code !== loginDto.otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    this.otpStore.delete(loginDto.phone);

    const tokens = this.generateTokens(user);
    return { user, tokens };
  }

  async switchRole(
    userId: string,
    activeRole: UserRole,
  ): Promise<{ tokens: AuthTokens }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const availableRoles = user.roles && user.roles.length > 0
      ? user.roles
      : [user.role];

    if (!availableRoles.includes(activeRole)) {
      throw new BadRequestException('User does not have this role');
    }

    const tokens = this.generateTokensForRole(user, activeRole);
    return { tokens };
  }

  async addRole(
    userId: string,
    newRole: UserRole,
    firstName?: string,
    lastName?: string,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    // Only customer and provider roles can be self-added
    if (newRole !== UserRole.CUSTOMER && newRole !== UserRole.PROVIDER) {
      throw new BadRequestException('Only customer and provider roles can be self-added');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { customer: true, provider: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentRoles = user.roles && user.roles.length > 0
      ? user.roles
      : [user.role];

    if (currentRoles.includes(newRole)) {
      throw new ConflictException('User already has this role');
    }

    // Create profile FIRST, then update roles (avoid inconsistency)
    if (newRole === UserRole.CUSTOMER && !user.customer) {
      const customer = this.customerRepository.create({
        user,
        firstName: firstName || '',
        lastName: lastName || undefined,
      });
      await this.customerRepository.save(customer);
    } else if (newRole === UserRole.PROVIDER && !user.provider) {
      const provider = this.providerRepository.create({
        user,
        firstName: firstName || '',
        lastName: lastName || undefined,
      });
      await this.providerRepository.save(provider);
    }

    // Update roles after profile is created successfully
    user.roles = [...currentRoles, newRole];
    user.role = newRole;
    await this.userRepository.save(user);

    const tokens = this.generateTokens(user);
    return { user, tokens };
  }

  async refreshToken(refreshToken: string): Promise<{ tokens: AuthTokens }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const tokens = this.generateTokens(user);
      return { tokens };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(user: User): AuthTokens {
    return this.generateTokensForRole(user, user.role);
  }

  private generateTokensForRole(user: User, activeRole: UserRole): AuthTokens {
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: activeRole,
    };

    return {
      accessToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
      }),
      refreshToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
