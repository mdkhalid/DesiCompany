import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { SoftBlockService } from '../payments/soft-block.service';
import { UpdateSoftBlockConfigDto } from '../payments/dto/soft-block-config.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminConfigController {
  constructor(private readonly softBlockService: SoftBlockService) {}

  @Get('soft-block-config')
  getConfig() {
    return this.softBlockService.getConfig();
  }

  @Patch('soft-block-config')
  updateConfig(@Body() dto: UpdateSoftBlockConfigDto) {
    return this.softBlockService.updateConfig(dto);
  }

  @Patch('check-soft-blocks')
  async checkSoftBlocks() {
    return this.softBlockService.checkAndBlockProviders();
  }
}
