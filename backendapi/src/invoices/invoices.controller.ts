import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':bookingId')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get invoice data as JSON' })
  @ApiResponse({ status: 200, description: 'Returns invoice data' })
  getInvoice(@Param('bookingId') bookingId: string) {
    return this.invoicesService.generateInvoice(bookingId);
  }

  @Get(':bookingId/html')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get invoice as HTML' })
  async getInvoiceHTML(
    @Param('bookingId') bookingId: string,
    @Res() res: Response,
  ) {
    const html = await this.invoicesService.getInvoiceHTML(bookingId);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${bookingId}.html"`,
    );
    res.send(html);
  }

  @Get(':bookingId/download')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Download invoice as HTML file' })
  async downloadInvoice(
    @Param('bookingId') bookingId: string,
    @Res() res: Response,
  ) {
    const html = await this.invoicesService.getInvoiceHTML(bookingId);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${bookingId}.html"`,
    );
    res.send(html);
  }
}