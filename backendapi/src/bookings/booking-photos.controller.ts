import {
  Controller, Get, Post, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingPhotosService } from './booking-photos.service';
import { PhotoStage } from './entities/booking-photo.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Booking Photos')
@ApiBearerAuth()
@Controller('booking-photos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingPhotosController {
  constructor(private readonly photosService: BookingPhotosService) {}

  @Post('booking/:bookingId')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload photo for booking stage' })
  addPhoto(
    @Param('bookingId') bookingId: string,
    @Body('stage') stage: PhotoStage,
    @Body('photoUrl') photoUrl: string,
    @Body('caption') caption?: string,
  ) {
    return this.photosService.addPhoto(bookingId, stage, photoUrl, caption);
  }

  @Get('booking/:bookingId')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all photos for a booking' })
  getBookingPhotos(@Param('bookingId') bookingId: string) {
    return this.photosService.getBookingPhotos(bookingId);
  }

  @Get('booking/:bookingId/stage/:stage')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get photos by stage' })
  getStagePhotos(
    @Param('bookingId') bookingId: string,
    @Param('stage') stage: PhotoStage,
  ) {
    return this.photosService.getStagePhotos(bookingId, stage);
  }

  @Delete(':id')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a photo' })
  deletePhoto(@Param('id') id: string) {
    return this.photosService.deletePhoto(id);
  }
}