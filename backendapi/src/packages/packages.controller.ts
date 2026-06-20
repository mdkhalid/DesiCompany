import { Controller, Get, Post, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthRequest {
  user: { id: string };
}

@ApiTags('Service Packages')
@ApiBearerAuth()
@Controller('packages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post()
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Create a service bundle package' })
  create(
    @Req() req: AuthRequest,
    @Body('name') name: string,
    @Body('description') description: string,
    @Body('serviceIds') serviceIds: string[],
    @Body('bundlePrice') bundlePrice: number,
  ) {
    return this.packagesService.createPackage(req.user.id, name, description, serviceIds, bundlePrice);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active service packages' })
  getAllActive() {
    return this.packagesService.getAllActivePackages();
  }

  @Get('provider/:providerId')
  @ApiOperation({ summary: 'Get packages for a specific provider' })
  getProviderPackages(@Param('providerId') providerId: string) {
    return this.packagesService.getProviderPackages(providerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get package by ID' })
  getOne(@Param('id') id: string) {
    return this.packagesService.getPackageById(id);
  }

  @Delete(':id')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Deactivate a package' })
  deactivate(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.packagesService.deactivatePackage(req.user.id, id);
  }
}