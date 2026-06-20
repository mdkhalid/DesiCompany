import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthRequest {
  user: { id: string };
}

@ApiTags('Promotions')
@ApiBearerAuth()
@Controller('promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Create a promoted listing' })
  create(
    @Req() req: AuthRequest,
    @Query('categoryId') categoryId: string | null,
    @Query('bidAmount') bidAmount: number,
    @Query('days') days: number,
  ) {
    return this.promotionsService.createPromotion(
      req.user.id,
      categoryId,
      bidAmount,
      days,
    );
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active promotions (sorted by priority)' })
  active(@Query('categoryId') categoryId?: string) {
    return this.promotionsService.getActivePromotions(categoryId);
  }

  @Get('provider/:providerId')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get provider promotion history' })
  getProviderPromotions(@Param('providerId') providerId: string) {
    return this.promotionsService.getProviderPromotions(providerId);
  }

  @Post(':id/click')
  @ApiOperation({ summary: 'Record a click on the promotion' })
  click(@Param('id') id: string) {
    return this.promotionsService.recordClick(id);
  }

  @Post('expire-old')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Expire old promotions' })
  expire() {
    return this.promotionsService.expireOldPromotions();
  }
}
