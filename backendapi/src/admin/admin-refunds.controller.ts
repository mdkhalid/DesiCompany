import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminRefundsService } from './admin-refunds.service';
import { AdminRefundDto } from '../payments/dto/admin-refund.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminRefundsController {
  constructor(private readonly adminRefundsService: AdminRefundsService) {}

  @Post('refunds')
  async refund(@Body() dto: AdminRefundDto) {
    return this.adminRefundsService.processRefund(dto);
  }
}
