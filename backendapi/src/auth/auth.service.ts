import {
  Injectable,
  Logger,
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
import { RevokedToken } from './entities/revoked-token.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { SmsService } from '../sms/sms.service';
import { OtpStoreService } from '../common/redis-otp.service';
import { ProviderGraceService } from '../provider-grace/provider-grace.service';

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
  role?: UserRole;
}

interface VerifyOtpDto {
  phone: string;
  otp: string;
}

export interface VerifyOtpResponse {
  user: {
    id: string;
    phone: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role: UserRole;
    roles: UserRole[];
  };
  availableRoles: UserRole[];
  defaultRole: UserRole;
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(RevokedToken)
    private readonly revokedTokenRepository: Repository<RevokedToken>,
    private readonly jwtService: JwtService,
    private readonly smsService: SmsService,
    private readonly otpStore: OtpStoreService,
    private readonly providerGraceService: ProviderGraceService,
  ) {}

  async requestOtp(phone: string): Promise<{ message: string }> {
    // Safety: block OTP mock in production
    const isMockMode =
      process.env.OTP_MOCK === 'true' && process.env.NODE_ENV !== 'production';

    const code = isMockMode
      ? process.env.OTP_MOCK_CODE || '123456'
      : this.generateOtp();

    await this.otpStore.set(phone, code);

    // Send SMS if not in mock mode
    if (!isMockMode) {
      try {
        await this.smsService.sendOtp(phone, code);
      } catch {
        this.logger.warn(
          `Failed to send OTP SMS to ${phone} — OTP still stored for verification`,
        );
      }
    }

    return { message: `OTP sent to ${phone}` };
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: Record<string, unknown> | User; tokens: AuthTokens }> {
    // Block admin registration via API - admins must be created through admin page
    if (registerDto.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin registration is not allowed');
    }

    // Validate OTP
    const storedCode = await this.otpStore.get(registerDto.phone);
    if (!storedCode) {
      throw new BadRequestException('OTP not found or expired');
    }
    if (storedCode !== registerDto.otp) {
      throw new UnauthorizedException('Invalid OTP');
    }
    await this.otpStore.delete(registerDto.phone);

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

    // Send welcome push about the 0% commission grace period (no-op if disabled)
    if (registerDto.role === UserRole.PROVIDER) {
      this.providerGraceService.sendWelcome(savedUser.id).catch(() => {});
    }

    const tokens = this.generateTokens(savedUser);

    // Reload with relations so providerId/customerId are available
    const fullUser = await this.userRepository.findOne({
      where: { id: savedUser.id },
      relations: { customer: true, provider: true },
    });

    return { user: this.toUserResponse(fullUser || savedUser), tokens };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ user: Record<string, unknown> | User; tokens: AuthTokens }> {
    const user = await this.userRepository.findOne({
      where: { phone: loginDto.phone },
      relations: { customer: true, provider: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    const storedCode = await this.otpStore.get(loginDto.phone);
    if (!storedCode) {
      throw new BadRequestException('OTP not found or expired');
    }

    if (storedCode !== loginDto.otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.otpStore.delete(loginDto.phone);

    // Build available roles from both the roles array and sub-entity presence
    const availableRoles: UserRole[] = [];
    if (user.customer || user.roles?.includes(UserRole.CUSTOMER)) {
      availableRoles.push(UserRole.CUSTOMER);
    }
    if (user.provider || user.roles?.includes(UserRole.PROVIDER)) {
      availableRoles.push(UserRole.PROVIDER);
    }
    if (availableRoles.length === 0) {
      availableRoles.push(user.role);
    }

    // Sync the roles column if stale or empty
    const rolesChanged =
      !user.roles ||
      user.roles.length === 0 ||
      availableRoles.length !== user.roles.length ||
      availableRoles.some((r) => !user.roles.includes(r));
    if (rolesChanged) {
      user.roles = availableRoles;
    }

    if (loginDto.role && loginDto.role !== user.role) {
      if (!availableRoles.includes(loginDto.role)) {
        throw new BadRequestException('User does not have this role');
      }
      user.role = loginDto.role;
    }

    await this.userRepository.save(user);

    const tokens = this.generateTokens(user);
    return { user: this.toUserResponse(user), tokens };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<VerifyOtpResponse> {
    const user = await this.userRepository.findOne({
      where: { phone: verifyOtpDto.phone },
      relations: { customer: true, provider: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    const storedCode = await this.otpStore.get(verifyOtpDto.phone);
    if (!storedCode) {
      throw new BadRequestException('OTP not found or expired');
    }

    if (storedCode !== verifyOtpDto.otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const availableRoles: UserRole[] = [];

    if (user.customer || user.roles?.includes(UserRole.CUSTOMER)) {
      availableRoles.push(UserRole.CUSTOMER);
    }
    if (user.provider || user.roles?.includes(UserRole.PROVIDER)) {
      availableRoles.push(UserRole.PROVIDER);
    }

    if (availableRoles.length === 0) {
      availableRoles.push(user.role);
    }

    // Sync the roles column if stale or empty (migrated users)
    const rolesChanged =
      !user.roles ||
      user.roles.length === 0 ||
      availableRoles.length !== user.roles.length ||
      availableRoles.some((r) => !user.roles.includes(r));
    if (rolesChanged) {
      user.roles = availableRoles;
      await this.userRepository.save(user);
    }

    const userResponse = {
      id: user.id,
      phone: user.phone,
      firstName: user.customer?.firstName,
      lastName: user.customer?.lastName || user.provider?.lastName,
      email: user.email,
      role: user.role,
      roles: availableRoles,
    };

    return {
      user: userResponse,
      availableRoles,
      defaultRole: user.role,
    };
  }

  async switchRole(
    userId: string,
    activeRole: UserRole,
  ): Promise<{ user: Record<string, unknown> | User; tokens: AuthTokens }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { customer: true, provider: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build available roles from both the roles array and sub-entity presence
    const availableRoles: UserRole[] = [];
    if (user.customer || user.roles?.includes(UserRole.CUSTOMER)) {
      if (!availableRoles.includes(UserRole.CUSTOMER))
        availableRoles.push(UserRole.CUSTOMER);
    }
    if (user.provider || user.roles?.includes(UserRole.PROVIDER)) {
      if (!availableRoles.includes(UserRole.PROVIDER))
        availableRoles.push(UserRole.PROVIDER);
    }
    if (availableRoles.length === 0) {
      availableRoles.push(user.role);
    }

    // Sync the roles column if it's stale or empty
    const rolesChanged =
      !user.roles ||
      user.roles.length === 0 ||
      availableRoles.length !== user.roles.length ||
      availableRoles.some((r) => !user.roles.includes(r));
    if (rolesChanged) {
      user.roles = availableRoles;
    }

    if (!availableRoles.includes(activeRole)) {
      throw new BadRequestException('User does not have this role');
    }

    // Defensive fix: if user has provider role but no provider entity, create it
    if (activeRole === UserRole.PROVIDER && !user.provider) {
      const customerData = user.customer;
      const provider = this.providerRepository.create({
        user,
        firstName: customerData?.firstName || '',
        lastName: customerData?.lastName || undefined,
      });
      await this.providerRepository.save(provider);
      user.provider = provider;
    }

    // Defensive fix: if user has customer role but no customer entity, create it
    if (activeRole === UserRole.CUSTOMER && !user.customer) {
      const providerData = user.provider;
      const customer = this.customerRepository.create({
        user,
        firstName: providerData?.firstName || '',
        lastName: providerData?.lastName || undefined,
      });
      await this.customerRepository.save(customer);
      user.customer = customer;
    }

    // Update the active role in the DB
    user.role = activeRole;
    await this.userRepository.save(user);

    const tokens = this.generateTokensForRole(user, activeRole);
    return { user: this.toUserResponse(user), tokens };
  }

  async addRole(
    userId: string,
    newRole: UserRole,
    firstName?: string,
    lastName?: string,
  ): Promise<{ user: Record<string, unknown> | User; tokens: AuthTokens }> {
    // Only customer and provider roles can be self-added
    if (newRole !== UserRole.CUSTOMER && newRole !== UserRole.PROVIDER) {
      throw new BadRequestException(
        'Only customer and provider roles can be self-added',
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { customer: true, provider: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentRoles =
      user.roles && user.roles.length > 0 ? user.roles : [user.role];

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

    // Reload user with relations to ensure provider/customer is included in response
    const updatedUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: { customer: true, provider: true },
    });

    const tokens = this.generateTokens(user);
    return { user: this.toUserResponse(updatedUser || user), tokens };
  }

  async refreshToken(refreshToken: string): Promise<{ tokens: AuthTokens }> {
    try {
      // Check if token is revoked
      const isRevoked = await this.revokedTokenRepository.findOne({
        where: { token: refreshToken },
      });
      if (isRevoked) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

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
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // Store revoked token with its expiry (7 days from now as fallback)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const revoked = this.revokedTokenRepository.create({
        token: refreshToken,
        expiresAt,
      });
      await this.revokedTokenRepository.save(revoked);

      return { message: 'Logged out successfully' };
    } catch {
      // Even if token is invalid, return success (client-side logout)
      return { message: 'Logged out successfully' };
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

  private toUserResponse(user: User): Record<string, unknown> {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      roles: user.roles,
      status: user.status,
      profileImage: user.profileImage,
      language: user.language,
      customerId: user.customer?.id ?? null,
      customer: user.customer ?? null,
      providerId: user.provider?.id ?? null,
      provider: user.provider ?? null,
    };
  }
}
