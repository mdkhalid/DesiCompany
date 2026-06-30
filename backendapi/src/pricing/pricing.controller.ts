import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DynamicPricingService } from './dynamic-pricing.service';

@ApiTags('Pricing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: DynamicPricingService) {}

  @Post('preview')
  @ApiOperation({ summary: 'Get dynamic pricing preview for a booking' })
  preview(
    @Body('baseAmount') baseAmount: number,
    @Body('scheduledDate') scheduledDate: string,
    @Body('categoryId') categoryId?: string,
  ) {
    return this.pricingService.getPricingPreview(
      baseAmount,
      new Date(scheduledDate),
      categoryId,
    );
  }
}
