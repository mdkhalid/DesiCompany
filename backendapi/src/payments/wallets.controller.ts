import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { WalletsService } from './wallets.service';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('wallet')
  @Roles(UserRole.PROVIDER, UserRole.CUSTOMER, UserRole.ADMIN)
  async getWallet(@Req() req: AuthRequest) {
    return this.walletsService.getWallet(req.user.id);
  }

  @Get('wallet/transactions')
  @Roles(UserRole.PROVIDER, UserRole.CUSTOMER, UserRole.ADMIN)
  async getTransactions(
    @Req() req: AuthRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.walletsService.getTransactions(req.user.id, page, limit);
  }
}
