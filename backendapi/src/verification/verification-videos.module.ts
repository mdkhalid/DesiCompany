import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationVideosController } from './verification-videos.controller';
import { VerificationVideosService } from './verification-videos.service';
import { VerificationVideo } from './entities/verification-video.entity';
import { Provider } from '../users/entities/provider.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VerificationVideo, Provider])],
  controllers: [VerificationVideosController],
  providers: [VerificationVideosService],
  exports: [VerificationVideosService],
})
export class VerificationVideosModule {}