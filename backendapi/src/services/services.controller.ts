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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CommissionType } from '../common/enums/commission-type.enum';
import { CreateProviderServiceDto } from './dto/create-provider-service.dto';
import { UpdateProviderServiceDto } from './dto/update-provider-service.dto';
import { CreateProviderAvailabilityDto } from './dto/create-provider-availability.dto';
import { SearchProvidersDto } from './dto/search-providers.dto';
import { CreateDateOverrideDto } from './dto/date-override.dto';
import { SetWeeklyScheduleDto } from './dto/set-weekly-schedule.dto';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('providers')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all verified providers' })
  findAllProviders() {
    return this.servicesService.findAllVerifiedProviders();
  }

  @Get('search')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Search providers with filters' })
  searchProviders(@Query() dto: SearchProvidersDto) {
    return this.servicesService.searchVerifiedProviders(dto);
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
  ) {
    return this.servicesService.createCategory({
      nameEn,
      nameHi,
      icon,
      commissionType: commissionType || CommissionType.PERCENTAGE,
      commissionValue: commissionValue || 10,
      parentId,
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
  ) {
    return this.servicesService.updateCategory(id, {
      nameEn,
      nameHi,
      icon,
      commissionType,
      commissionValue,
      isActive,
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
  findProviderServices(@Query('providerId') providerId: string) {
    return this.servicesService.findProviderServices(providerId);
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
  findProviderAvailability(@Query('providerId') providerId: string) {
    return this.servicesService.findProviderAvailability(providerId);
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
  setWeeklySchedule(
    @Query('providerId') providerId: string,
    @Body() dto: SetWeeklyScheduleDto,
  ) {
    return this.servicesService.setWeeklySchedule(providerId, dto.slots);
  }

  @Get('date-overrides')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get date overrides for provider' })
  getDateOverrides(@Query('providerId') providerId: string) {
    return this.servicesService.getDateOverrides(providerId);
  }

  @Post('date-overrides')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Create date override (holiday/special hours)' })
  @ApiResponse({ status: 201, description: 'Date override created' })
  createDateOverride(
    @Query('providerId') providerId: string,
    @Body() dto: CreateDateOverrideDto,
  ) {
    return this.servicesService.createDateOverride(providerId, dto);
  }

  @Patch('date-overrides/:id')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Update date override' })
  updateDateOverride(
    @Query('providerId') providerId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateDateOverrideDto>,
  ) {
    return this.servicesService.updateDateOverride(providerId, id, dto);
  }

  @Delete('date-overrides/:id')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Delete date override' })
  deleteDateOverride(
    @Query('providerId') providerId: string,
    @Param('id') id: string,
  ) {
    return this.servicesService.deleteDateOverride(providerId, id);
  }

  @Get('available-slots')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get available time slots for a date' })
  @ApiResponse({ status: 200, description: 'Returns available slots' })
  getAvailableSlots(
    @Query('providerId') providerId: string,
    @Query('date') date: string,
  ) {
    return this.servicesService.getAvailableSlots(providerId, date);
  }
}
