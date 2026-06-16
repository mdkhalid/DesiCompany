import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
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

@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('search')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  searchProviders(@Query() dto: SearchProvidersDto) {
    return this.servicesService.searchVerifiedProviders(dto);
  }

  @Get('categories')
  findAllCategories() {
    return this.servicesService.findAllCategories();
  }

  @Post('categories')
  @Roles(UserRole.ADMIN)
  createCategory(
    @Body('nameEn') nameEn: string,
    @Body('nameHi') nameHi: string,
    @Body('icon') icon?: string,
    @Body('commissionType') commissionType?: CommissionType,
    @Body('commissionValue') commissionValue?: number,
  ) {
    return this.servicesService.createCategory({
      nameEn,
      nameHi,
      icon,
      commissionType: commissionType || CommissionType.PERCENTAGE,
      commissionValue: commissionValue || 10,
    });
  }

  @Patch('categories/:id')
  @Roles(UserRole.ADMIN)
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
  deleteCategory(@Param('id') id: string) {
    return this.servicesService.deleteCategory(id);
  }

  @Get('provider-services')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  findProviderServices(@Query('providerId') providerId: string) {
    return this.servicesService.findProviderServices(providerId);
  }

  @Get('provider-services/:id')
  @Roles(UserRole.PROVIDER, UserRole.CUSTOMER, UserRole.ADMIN)
  findProviderServiceById(@Param('id') id: string) {
    return this.servicesService.findProviderServiceById(id);
  }

  @Post('provider-services')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  createProviderService(@Body() dto: CreateProviderServiceDto) {
    return this.servicesService.createProviderService(dto);
  }

  @Patch('provider-services/:id')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  updateProviderService(
    @Param('id') id: string,
    @Body() dto: UpdateProviderServiceDto,
  ) {
    return this.servicesService.updateProviderService(id, dto);
  }

  @Delete('provider-services/:id')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  deleteProviderService(@Param('id') id: string) {
    return this.servicesService.deleteProviderService(id);
  }

  @Get('availabilities')
  @Roles(UserRole.PROVIDER, UserRole.CUSTOMER, UserRole.ADMIN)
  findProviderAvailability(@Query('providerId') providerId: string) {
    return this.servicesService.findProviderAvailability(providerId);
  }

  @Post('availabilities')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  createProviderAvailability(@Body() dto: CreateProviderAvailabilityDto) {
    return this.servicesService.createProviderAvailability(dto);
  }

  @Delete('availabilities/:id')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  deleteProviderAvailability(@Param('id') id: string) {
    return this.servicesService.deleteProviderAvailability(id);
  }
}
