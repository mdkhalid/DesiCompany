import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ServiceAreaMapService } from './service-area-map.service';

@ApiTags('Service Area Map')
@Controller('map')
export class ServiceAreaMapController {
  constructor(private readonly serviceAreaMapService: ServiceAreaMapService) {}

  @Get('providers')
  @ApiOperation({
    summary: 'Get providers within a bounding box (for map display)',
  })
  getProvidersInBox(
    @Query('minLat') minLat: number,
    @Query('maxLat') maxLat: number,
    @Query('minLng') minLng: number,
    @Query('maxLng') maxLng: number,
  ) {
    return this.serviceAreaMapService.getProvidersInBoundingBox({
      minLat: Number(minLat),
      maxLat: Number(maxLat),
      minLng: Number(minLng),
      maxLng: Number(maxLng),
    });
  }

  @Get('coverage')
  @ApiOperation({ summary: 'Get service area coverage stats for a location' })
  getCoverage(@Query('lat') lat: number, @Query('lng') lng: number) {
    return this.serviceAreaMapService.getServiceAreaCoverage(
      Number(lat),
      Number(lng),
    );
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Get providers around a location with radius' })
  getNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radiusKm') radiusKm: number,
  ) {
    return this.serviceAreaMapService.getProvidersAroundLocation(
      Number(lat),
      Number(lng),
      Number(radiusKm),
    );
  }
}
