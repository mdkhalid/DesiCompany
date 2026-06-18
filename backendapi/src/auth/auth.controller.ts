import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  requestOtp(@Body('phone') phone: string) {
    return this.authService.requestOtp(phone);
  }

  @Post('register')
  register(
    @Body('phone') phone: string,
    @Body('role') role: UserRole,
    @Body('firstName') firstName?: string,
    @Body('lastName') lastName?: string,
    @Body('email') email?: string,
  ) {
    return this.authService.register({
      phone,
      role,
      firstName,
      lastName,
      email,
    });
  }

  @Post('login')
  login(@Body('phone') phone: string, @Body('otp') otp: string) {
    return this.authService.login({ phone, otp });
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
}
