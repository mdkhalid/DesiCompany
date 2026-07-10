import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ProviderGraceService } from './provider-grace.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthenticatedRequest {
  user: { id: string; role: UserRole };
}

@Controller('provider-grace')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProviderGraceController {
  constructor(private readonly providerGraceService: ProviderGraceService) {}

  @Get('status')
  @Roles(UserRole.PROVIDER)
  getStatus(@Req() req: AuthenticatedRequest) {
    return this.providerGraceService.getGraceStatus(req.user.id);
  }

  @Get('commission-saved')
  @Roles(UserRole.PROVIDER)
  getCommissionSaved(@Req() req: AuthenticatedRequest) {
    return this.providerGraceService.getCommissionSaved(req.user.id);
  }
}
