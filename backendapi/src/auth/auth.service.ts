import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
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
  role: UserRole;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface LoginDto {
  phone: string;
  otp: string;
}

@Injectable()
export class AuthService {
  private readonly otpStore = new Map<string, { code: string; expiresAt: Date }>();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    private readonly jwtService: JwtService,
  ) {}

  async requestOtp(phone: string): Promise<{ message: string }> {
    const code = process.env.OTP_MOCK === 'true' ? process.env.OTP_MOCK_CODE || '123456' : this.generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    this.otpStore.set(phone, { code, expiresAt });

    // TODO: Integrate SMS provider here for production
    return { message: `OTP sent to ${phone}` };
  }

  async register(registerDto: RegisterDto): Promise<{ user: User; tokens: any }> {
    const existingUser = await this.userRepository.findOne({ where: { phone: registerDto.phone } });
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const user = this.userRepository.create({
      phone: registerDto.phone,
      role: registerDto.role,
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

  async login(loginDto: LoginDto): Promise<{ user: User; tokens: any }> {
    const user = await this.userRepository.findOne({ where: { phone: loginDto.phone } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
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

  async refreshToken(refreshToken: string): Promise<{ tokens: any }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.userRepository.findOne({ where: { id: payload.sub } as any });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const tokens = this.generateTokens(user);
      return { tokens };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(user: User): any {
    const payload = { sub: user.id, phone: user.phone, role: user.role };

    return {
      accessToken: this.jwtService.sign(payload as any, {
        secret: process.env.JWT_SECRET,
      }),
      refreshToken: this.jwtService.sign(payload as any, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
