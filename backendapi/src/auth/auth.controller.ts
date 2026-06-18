import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
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
  login(@Body('phone') phone: string, @Body('otp') otp: string) {
    return this.authService.login({ phone, otp });
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('switch-role')
  @UseGuards(AuthGuard('jwt'))
  switchRole(
    @Req() req: { user: { id: string } },
    @Body('activeRole') activeRole: UserRole,
  ) {
    return this.authService.switchRole(req.user.id, activeRole);
  }

  @Post('add-role')
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
