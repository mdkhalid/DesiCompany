import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VerificationVideosService } from './verification-videos.service';
import { VerificationVideoStatus } from './entities/verification-video.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthRequest {
  user: { id: string };
}

@ApiTags('Provider Verification Video')
@ApiBearerAuth()
@Controller('verification-videos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VerificationVideosController {
  constructor(private readonly videosService: VerificationVideosService) {}

  @Post()
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Upload verification video' })
  upload(
    @Req() req: AuthRequest,
    @Body('videoUrl') videoUrl: string,
    @Body('durationSeconds') durationSeconds: number,
    @Body('thumbnailUrl') thumbnailUrl?: string,
  ) {
    return this.videosService.uploadVideo(req.user.id, videoUrl, durationSeconds, thumbnailUrl);
  }

  @Get('provider/:providerId')
  @ApiOperation({ summary: 'Get verification video for a provider' })
  getProviderVideo(@Param('providerId') providerId: string) {
    return this.videosService.getProviderVideo(providerId);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get pending verification videos (admin)' })
  getPending() {
    return this.videosService.getPendingVideos();
  }

  @Post(':id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve or reject verification video' })
  review(
    @Param('id') id: string,
    @Body('status') status: VerificationVideoStatus,
    @Body('notes') notes?: string,
  ) {
    return this.videosService.reviewVideo(id, status, notes);
  }
}