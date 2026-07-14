import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServicesService } from './services.service';
import { Provider } from '../users/entities/provider.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CommissionType } from '../common/enums/commission-type.enum';
import { PricingModel } from '../common/enums/pricing-model.enum';
import { CreateProviderServiceDto } from './dto/create-provider-service.dto';
import { UpdateProviderServiceDto } from './dto/update-provider-service.dto';
import { CreateProviderAvailabilityDto } from './dto/create-provider-availability.dto';
import { SearchProvidersDto } from './dto/search-providers.dto';
import { CreateDateOverrideDto } from './dto/date-override.dto';
import { SetWeeklyScheduleDto } from './dto/set-weekly-schedule.dto';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  /**
   * Resolves a providerId from a query param or the authenticated user's provider entity.
   * Throws BadRequestException if neither source yields a valid providerId.
   */
  private async resolveProviderId(
    req: AuthRequest,
    queryProviderId?: string,
  ): Promise<string> {
    if (queryProviderId) return queryProviderId;

    const provider = await this.providerRepository.findOne({
      where: { user: { id: req.user.id } },
    });
    if (provider) return provider.id;

    throw new BadRequestException('providerId is required');
  }

  @Get('providers')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all verified providers' })
  findAllProviders(@Req() req: AuthRequest) {
    return this.servicesService.findAllVerifiedProviders(req.user.id);
  }

  @Get('search')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Search providers with filters' })
  searchProviders(@Query() dto: SearchProvidersDto, @Req() req: AuthRequest) {
    return this.servicesService.searchVerifiedProviders(dto, req.user.id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all service categories' })
  findAllCategories() {
    return this.servicesService.findAllCategories();
  }

  @Get('categories/:id/subcategories')
  @ApiOperation({ summary: 'Get subcategories for a category' })
  findSubcategories(@Param('id') id: string) {
    return this.servicesService.findSubcategories(id);
  }

  @Post('categories')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a service category' })
  createCategory(
    @Body('nameEn') nameEn: string,
    @Body('nameHi') nameHi: string,
    @Body('icon') icon?: string,
    @Body('commissionType') commissionType?: CommissionType,
    @Body('commissionValue') commissionValue?: number,
    @Body('parentId') parentId?: string,
    @Body('pricingModels') pricingModels?: PricingModel[],
    @Body('defaultPricingModel') defaultPricingModel?: PricingModel,
  ) {
    return this.servicesService.createCategory({
      nameEn,
      nameHi,
      icon,
      commissionType: commissionType || CommissionType.PERCENTAGE,
      commissionValue: commissionValue || 10,
      parentId,
      pricingModels,
      defaultPricingModel,
    });
  }

  @Patch('categories/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a service category' })
  updateCategory(
    @Param('id') id: string,
    @Body('nameEn') nameEn?: string,
    @Body('nameHi') nameHi?: string,
    @Body('icon') icon?: string,
    @Body('commissionType') commissionType?: CommissionType,
    @Body('commissionValue') commissionValue?: number,
    @Body('isActive') isActive?: boolean,
    @Body('pricingModels') pricingModels?: PricingModel[],
    @Body('defaultPricingModel') defaultPricingModel?: PricingModel,
  ) {
    return this.servicesService.updateCategory(id, {
      nameEn,
      nameHi,
      icon,
      commissionType,
      commissionValue,
      isActive,
      pricingModels,
      defaultPricingModel,
    });
  }

  @Delete('categories/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a service category' })
  deleteCategory(@Param('id') id: string) {
    return this.servicesService.deleteCategory(id);
  }

  @Get('providers/:providerId/services')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get services for a provider' })
  findProviderServicesByProviderId(@Param('providerId') providerId: string) {
    return this.servicesService.findProviderServices(providerId);
  }

  @Get('provider-services')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current provider services' })
  async findProviderServices(
    @Query('providerId') providerId: string,
    @Req() req: AuthRequest,
  ) {
    return this.servicesService.findProviderServices(
      await this.resolveProviderId(req, providerId),
    );
  }

  @Get('provider-services/:id')
  @Roles(UserRole.PROVIDER, UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get provider service by ID' })
  findProviderServiceById(@Param('id') id: string) {
    return this.servicesService.findProviderServiceById(id);
  }

  @Post('provider-services')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a provider service' })
  createProviderService(@Body() dto: CreateProviderServiceDto) {
    return this.servicesService.createProviderService(dto);
  }

  @Patch('provider-services/:id')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a provider service' })
  updateProviderService(
    @Param('id') id: string,
    @Body() dto: UpdateProviderServiceDto,
  ) {
    return this.servicesService.updateProviderService(id, dto);
  }

  @Delete('provider-services/:id')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a provider service' })
  deleteProviderService(@Param('id') id: string) {
    return this.servicesService.deleteProviderService(id);
  }

  @Get('availabilities')
  @Roles(UserRole.PROVIDER, UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get provider availability schedule' })
  async findProviderAvailability(
    @Query('providerId') providerId: string,
    @Req() req: AuthRequest,
  ) {
    return this.servicesService.findProviderAvailability(
      await this.resolveProviderId(req, providerId),
    );
  }

  @Post('availabilities')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create availability slot' })
  createProviderAvailability(@Body() dto: CreateProviderAvailabilityDto) {
    return this.servicesService.createProviderAvailability(dto);
  }

  @Delete('availabilities/:id')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete availability slot' })
  deleteProviderAvailability(@Param('id') id: string) {
    return this.servicesService.deleteProviderAvailability(id);
  }

  @Put('availabilities/weekly')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Replace entire weekly schedule (batch set)' })
  @ApiResponse({ status: 200, description: 'Weekly schedule updated' })
  async setWeeklySchedule(
    @Query('providerId') providerId: string,
    @Body() dto: SetWeeklyScheduleDto,
    @Req() req: AuthRequest,
  ) {
    return this.servicesService.setWeeklySchedule(
      await this.resolveProviderId(req, providerId),
      dto.slots,
    );
  }

  @Get('date-overrides')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get date overrides for provider' })
  async getDateOverrides(
    @Query('providerId') providerId: string,
    @Req() req: AuthRequest,
  ) {
    return this.servicesService.getDateOverrides(
      await this.resolveProviderId(req, providerId),
    );
  }

  @Post('date-overrides')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Create date override (holiday/special hours)' })
  @ApiResponse({ status: 201, description: 'Date override created' })
  async createDateOverride(
    @Query('providerId') providerId: string,
    @Body() dto: CreateDateOverrideDto,
    @Req() req: AuthRequest,
  ) {
    return this.servicesService.createDateOverride(
      await this.resolveProviderId(req, providerId),
      dto,
    );
  }

  @Patch('date-overrides/:id')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Update date override' })
  async updateDateOverride(
    @Query('providerId') providerId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateDateOverrideDto>,
    @Req() req: AuthRequest,
  ) {
    return this.servicesService.updateDateOverride(
      await this.resolveProviderId(req, providerId),
      id,
      dto,
    );
  }

  @Delete('date-overrides/:id')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Delete date override' })
  async deleteDateOverride(
    @Query('providerId') providerId: string,
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return this.servicesService.deleteDateOverride(
      await this.resolveProviderId(req, providerId),
      id,
    );
  }

  @Get('available-slots')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get available time slots for a date' })
  @ApiResponse({ status: 200, description: 'Returns available slots' })
  async getAvailableSlots(
    @Query('providerId') providerId: string,
    @Query('date') date: string,
    @Req() req: AuthRequest,
  ) {
    return this.servicesService.getAvailableSlots(
      await this.resolveProviderId(req, providerId),
      date,
    );
  }

  // ─── Busy Slots (Provider-managed unavailable time slots) ─────

  @Get('busy-slots')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get busy slots for a provider, optionally filtered by date',
  })
  getBusySlots(
    @Query('providerId') providerId: string,
    @Query('date') date?: string,
  ) {
    return this.servicesService.getBusySlots(providerId, date);
  }

  @Post('busy-slots')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a busy time slot (unavailable block)' })
  createBusySlot(
    @Body()
    body: {
      providerId: string;
      busyDate: string;
      startTime: string;
      endTime: string;
      reason?: string;
    },
  ) {
    return this.servicesService.createBusySlot(body.providerId, {
      busyDate: body.busyDate,
      startTime: body.startTime,
      endTime: body.endTime,
      reason: body.reason,
    });
  }

  @Delete('busy-slots/:id')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a busy slot' })
  deleteBusySlot(
    @Param('id') id: string,
    @Query('providerId') providerId: string,
  ) {
    return this.servicesService.deleteBusySlot(providerId, id);
  }
}
