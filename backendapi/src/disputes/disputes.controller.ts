import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@Controller('disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER)
  create(@Body() dto: CreateDisputeDto, @Req() req: AuthRequest) {
    return this.disputesService.create(dto, req.user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.disputesService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER, UserRole.PROVIDER)
  findOne(@Param('id') id: string) {
    return this.disputesService.findOne(id);
  }

  @Patch(':id/resolve')
  @Roles(UserRole.ADMIN)
  resolve(@Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.disputesService.resolve(id, dto);
  }
}
