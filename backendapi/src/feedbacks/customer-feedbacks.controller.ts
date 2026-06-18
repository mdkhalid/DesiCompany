import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateCustomerFeedbackDto } from './dto/create-customer-feedback.dto';
import { CustomerFeedbacksService } from './customer-feedbacks.service';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@Controller('feedbacks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerFeedbacksController {
  constructor(
    private readonly customerFeedbacksService: CustomerFeedbacksService,
  ) {}

  @Post()
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  create(@Body() dto: CreateCustomerFeedbackDto, @Req() req: AuthRequest) {
    return this.customerFeedbacksService.create(dto, req.user.id);
  }

  @Get('provider/me')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  findMine(@Req() req: AuthRequest) {
    return this.customerFeedbacksService.findByProviderUser(req.user.id);
  }
}
