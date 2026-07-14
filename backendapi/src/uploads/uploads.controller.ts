import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';

interface AuthRequest {
  user: { id: string };
}

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('chat-image')
  @ApiOperation({ summary: 'Upload chat image attachment' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadChatImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() _req: AuthRequest,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Route through StorageService so files go to S3/CDN when configured
    const result = await this.uploadsService.uploadFile(file, 'chat');

    return {
      url: result.url,
      filename: result.key,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Post('profile-image')
  @ApiOperation({ summary: 'Upload profile image' })
  @UseInterceptors(FileInterceptor('file'))
  uploadProfileImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() _req: AuthRequest,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const url = this.uploadsService.getFileUrl(`misc/${file.filename}`);
    return {
      url,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
