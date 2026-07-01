import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { Request } from 'express';
import { AdvertisementsService } from './advertisements.service';
import {
  AdPlacement,
  AdStatus,
  AdTargetAudience,
  Advertisement,
} from './entities/advertisement.entity';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@ApiTags('Advertisements')
@Controller('advertisements')
export class AdvertisementsController {
  constructor(private readonly adsService: AdvertisementsService) {}

  // ============ PUBLIC ENDPOINTS (for app to fetch ads) ============

  @Get('active')
  @ApiOperation({ summary: 'Get active ads for a placement (public)' })
  @ApiQuery({ name: 'placement', enum: AdPlacement })
  @ApiQuery({ name: 'categoryId', required: false })
  async getActiveAds(
    @Query('placement') placement: AdPlacement,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.adsService.getActiveAdsForPlacement(placement, categoryId);
  }

  @Post(':id/impression')
  @ApiOperation({ summary: 'Record an ad impression (public)' })
  async recordImpression(@Param('id') adId: string) {
    await this.adsService.recordImpression(adId);
    return { success: true };
  }

  @Post(':id/click')
  @ApiOperation({ summary: 'Record an ad click (public)' })
  async recordClick(@Param('id') adId: string) {
    await this.adsService.recordClick(adId);
    return { success: true };
  }

  // ============ ADMIN ENDPOINTS ============

  @Get('admin/all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all advertisements (admin)' })
  @ApiQuery({ name: 'status', enum: AdStatus, required: false })
  @ApiQuery({ name: 'placement', enum: AdPlacement, required: false })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  async getAllAds(
    @Query('status') status?: AdStatus,
    @Query('placement') placement?: AdPlacement,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.adsService.getAllAds({ status, placement, isActive });
  }

  @Get('admin/stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get advertisement dashboard stats (admin)' })
  async getDashboardStats() {
    return this.adsService.getDashboardStats();
  }

  @Get('admin/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get advertisement by ID (admin)' })
  async getAdById(@Param('id') adId: string) {
    return this.adsService.getAdById(adId);
  }

  @Get('admin/:id/analytics')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get advertisement analytics (admin)' })
  async getAdAnalytics(@Param('id') adId: string) {
    return this.adsService.getAdAnalytics(adId);
  }

  @Post('admin/create')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new advertisement (admin)' })
  async createAd(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      title: string;
      description?: string;
      imageUrl: string;
      thumbnailUrl?: string;
      targetUrl?: string;
      targetScreen?: string;
      placement: AdPlacement;
      targetAudience?: AdTargetAudience;
      startDate: string;
      endDate: string;
      priority?: number;
      categoryId?: string;
      maxImpressions?: number;
      maxClicks?: number;
      dailyImpressionLimit?: number;
      showCloseButton?: boolean;
      autoCloseSeconds?: number;
      backgroundColor?: string;
      textColor?: string;
      notes?: string;
    },
  ) {
    return this.adsService.createAd(req.user.id, {
      ...body,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
    });
  }

  @Put('admin/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an advertisement (admin)' })
  async updateAd(
    @Param('id') adId: string,
    @Body()
    body: Partial<{
      title: string;
      description: string;
      imageUrl: string;
      thumbnailUrl: string;
      targetUrl: string;
      targetScreen: string;
      placement: AdPlacement;
      targetAudience: AdTargetAudience;
      startDate: string;
      endDate: string;
      priority: number;
      categoryId: string;
      maxImpressions: number;
      maxClicks: number;
      dailyImpressionLimit: number;
      showCloseButton: boolean;
      autoCloseSeconds: number;
      backgroundColor: string;
      textColor: string;
      notes: string;
      status: AdStatus;
      isActive: boolean;
    }>,
  ) {
    const { startDate, endDate, ...restBody } = body;
    const updateData = {
      ...restBody,
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
    };

    return this.adsService.updateAd(adId, updateData as Partial<Advertisement>);
  }

  @Delete('admin/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete an advertisement (admin)' })
  async deleteAd(@Param('id') adId: string) {
    return this.adsService.deleteAd(adId);
  }

  @Patch('admin/:id/pause')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Pause an advertisement (admin)' })
  async pauseAd(@Param('id') adId: string) {
    return this.adsService.pauseAd(adId);
  }

  @Patch('admin/:id/resume')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resume a paused advertisement (admin)' })
  async resumeAd(@Param('id') adId: string) {
    return this.adsService.resumeAd(adId);
  }
}
