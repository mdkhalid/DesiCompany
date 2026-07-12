import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { LedgerEntryType } from './entities/ledger-entry.entity';

class PostEntryDto {
  accountCode: string;
  type: LedgerEntryType;
  amount: number;
  currency?: string;
  reference?: string;
  description?: string;
  bookingId?: string;
  paymentId?: string;
  providerId?: string;
  customerId?: string;
  metadata?: Record<string, any>;
}

@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('seed-defaults')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Seed default chart of accounts' })
  async seedDefaults() {
    await this.accountsService.ensureDefaults();
    return { status: 'ok' };
  }

  @Get('accounts')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List accounts' })
  list() {
    return this.accountsService.findAll();
  }

  @Get('accounts/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get account by id' })
  findOne(@Param('id') id: string) {
    return this.accountsService.findOne(id);
  }

  @Post('entries')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Post a ledger entry' })
  create(@Body() dto: PostEntryDto) {
    return this.accountsService.postEntry(dto);
  }
}
