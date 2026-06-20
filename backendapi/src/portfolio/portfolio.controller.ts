import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@ApiTags('Portfolio')
@ApiBearerAuth()
@Controller('portfolio')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Post()
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add portfolio item' })
  add(
    @Req() req: AuthRequest,
    @Body('title') title: string,
    @Body('imageUrl') imageUrl: string,
    @Body('description') description?: string,
    @Body('categoryId') categoryId?: string,
  ) {
    return this.portfolioService.addItem(
      req.user.id,
      title,
      imageUrl,
      description,
      categoryId,
    );
  }

  @Get('provider/:providerId')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get provider portfolio' })
  getProviderPortfolio(@Param('providerId') providerId: string) {
    return this.portfolioService.getProviderPortfolio(providerId);
  }

  @Get('provider/:providerId/category/:categoryId')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get portfolio items by category' })
  getByCategory(
    @Param('providerId') providerId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.portfolioService.getByCategory(providerId, categoryId);
  }

  @Delete(':id')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete portfolio item' })
  delete(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.portfolioService.deleteItem(req.user.id, id, req.user.role);
  }
}
