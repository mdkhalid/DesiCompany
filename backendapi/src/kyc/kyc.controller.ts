import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { KycStatus } from '../common/enums/kyc-status.enum';

@Controller('kyc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('upload')
  @Roles(UserRole.PROVIDER)
  @UseInterceptors(FileInterceptor('document'))
  uploadDocument(
    @Body('providerId') providerId: string,
    @Body('documentType') documentType: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.kycService.uploadDocument(providerId, documentType, file.path);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.kycService.findAll();
  }

  @Get('provider/:providerId')
  findByProvider(@Param('providerId') providerId: string) {
    return this.kycService.findByProvider(providerId);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: KycStatus,
    @Body('remarks') remarks?: string,
  ) {
    return this.kycService.updateStatus(id, status, remarks);
  }
}
