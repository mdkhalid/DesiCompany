import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminPaymentGatewaysService } from './admin-payment-gateways.service';
import type {
  CreateGatewayInput,
  UpdateGatewayInput,
  MaskedGatewayResponse,
} from './admin-payment-gateways.service';

@Controller('admin/payment-gateways')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPaymentGatewaysController {
  constructor(private readonly service: AdminPaymentGatewaysService) {}

  @Get()
  async findAll(): Promise<MaskedGatewayResponse[]> {
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MaskedGatewayResponse> {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: CreateGatewayInput,
  ): Promise<MaskedGatewayResponse> {
    return this.service.createGateway(body);
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateGatewayInput,
  ): Promise<MaskedGatewayResponse> {
    return this.service.updateGateway(id, body);
  }

  @Patch(':id/default')
  async setDefault(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MaskedGatewayResponse> {
    return this.service.setAsDefault(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.service.deleteGateway(id);
  }
}
