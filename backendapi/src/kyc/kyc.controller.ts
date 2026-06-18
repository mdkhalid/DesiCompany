import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(FilesInterceptor('documents', 10))
  async uploadDocuments(
    @Body('providerId') providerId: string,
    @Body('documentType') documentType: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      return [];
    }
    const results = [];
    for (const file of files) {
      const doc = await this.kycService.uploadDocument(
        providerId,
        documentType,
        file.path,
      );
      results.push(doc);
    }
    return results;
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
