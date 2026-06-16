import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards } from '@nestjs/common';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CommissionType } from '../common/enums/commission-type.enum';

@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

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
    return this.servicesService.updateCategory(id, { nameEn, nameHi, icon, commissionType, commissionValue, isActive });
  }

  @Delete('categories/:id')
  @Roles(UserRole.ADMIN)
  deleteCategory(@Param('id') id: string) {
    return this.servicesService.deleteCategory(id);
  }
}
