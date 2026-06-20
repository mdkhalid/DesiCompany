import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { ServicePackage } from './entities/service-package.entity';
import { Provider } from '../users/entities/provider.entity';
import { ProviderService } from '../services/entities/provider-service.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ServicePackage, Provider, ProviderService])],
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}