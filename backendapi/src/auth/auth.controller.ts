import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Request OTP for phone verification' })
  @ApiResponse({ status: 201, description: 'OTP sent' })
  requestOtp(@Body('phone') phone: string) {
    return this.authService.requestOtp(phone);
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered' })
  @ApiResponse({ status: 409, description: 'User already exists' })
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
  @ApiOperation({ summary: 'Login with phone and OTP' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(
    @Body('phone') phone: string,
    @Body('otp') otp: string,
    @Body('role') role?: UserRole,
  ) {
    return this.authService.login({ phone, otp, role });
  }

  @Post('verify-otp')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify OTP for phone' })
  @ApiResponse({ status: 200, description: 'OTP verified' })
  verifyOtp(@Body('phone') phone: string, @Body('otp') otp: string) {
    return this.authService.verifyOtp({ phone, otp });
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('logout')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  logout(@Body('refreshToken') refreshToken: string) {
    return this.authService.logout(refreshToken);
  }

  @Post('switch-role')
  @SkipThrottle()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Switch active role' })
  @ApiResponse({ status: 200, description: 'Role switched' })
  switchRole(
    @Req() req: { user: { id: string } },
    @Body('activeRole') activeRole: UserRole,
  ) {
    return this.authService.switchRole(req.user.id, activeRole);
  }

  @Post('add-role')
  @SkipThrottle()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a new role to current user' })
  @ApiResponse({ status: 201, description: 'Role added' })
  addRole(
    @Req() req: { user: { id: string } },
    @Body('role') role: UserRole,
    @Body('firstName') firstName?: string,
    @Body('lastName') lastName?: string,
  ) {
    return this.authService.addRole(req.user.id, role, firstName, lastName);
  }
}
