import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  requestOtp(@Body('phone') phone: string) {
    return this.authService.requestOtp(phone);
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(
    @Body('phone') phone: string,
    @Body('otp') otp: string,
    @Body('role') role: UserRole,
    @Body('firstName') firstName?: string,
    @Body('lastName') lastName?: string,
    @Body('email') email?: string,
  ) {
    return this.authService.register({
      phone,
      otp,
      role,
      firstName,
      lastName,
      email,
    });
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(
    @Body('phone') phone: string,
    @Body('otp') otp: string,
    @Body('role') role?: UserRole,
  ) {
    return this.authService.login({ phone, otp, role });
  }

  @Post('verify-otp')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verifyOtp(@Body('phone') phone: string, @Body('otp') otp: string) {
    return this.authService.verifyOtp({ phone, otp });
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('switch-role')
  @SkipThrottle()
  @UseGuards(AuthGuard('jwt'))
  switchRole(
    @Req() req: { user: { id: string } },
    @Body('activeRole') activeRole: UserRole,
  ) {
    return this.authService.switchRole(req.user.id, activeRole);
  }

  @Post('add-role')
  @SkipThrottle()
  @UseGuards(AuthGuard('jwt'))
  addRole(
    @Req() req: { user: { id: string } },
    @Body('role') role: UserRole,
    @Body('firstName') firstName?: string,
    @Body('lastName') lastName?: string,
  ) {
    return this.authService.addRole(req.user.id, role, firstName, lastName);
  }
}
