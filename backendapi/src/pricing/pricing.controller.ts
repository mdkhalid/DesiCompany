import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DynamicPricingService } from './dynamic-pricing.service';

@ApiTags('Pricing')
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