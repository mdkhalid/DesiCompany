import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateJobRequestDto } from './dto/create-job-request.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuotesService } from './quotes.service';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post('job-requests')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  createJobRequest(@Body() dto: CreateJobRequestDto, @Req() req: AuthRequest) {
    return this.quotesService.createJobRequest(dto, req.user.id);
  }

  @Get('job-requests/customer/me')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  findMyJobRequests(@Req() req: AuthRequest) {
    return this.quotesService.findMyJobRequests(req.user.id);
  }

  @Get('job-requests/open')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  findOpenJobRequests(
    @Req() req: AuthRequest,
    @Query('categoryId') categoryId?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    const latNum = lat !== undefined ? Number(lat) : undefined;
    const lngNum = lng !== undefined ? Number(lng) : undefined;
    const radiusNum = radiusKm !== undefined ? Number(radiusKm) : undefined;
    return this.quotesService.findOpenJobRequests(
      req.user.id,
      categoryId,
      latNum,
      lngNum,
      radiusNum,
    );
  }

  @Get('job-requests/:id')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  findJobRequestById(@Param('id') id: string) {
    return this.quotesService.findJobRequestById(id);
  }

  @Patch('job-requests/:id/cancel')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  cancelJobRequest(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.quotesService.cancelJobRequest(id, req.user.id);
  }

  @Post('job-requests/:id/quotes')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  createQuote(
    @Param('id') id: string,
    @Body() dto: CreateQuoteDto,
    @Req() req: AuthRequest,
  ) {
    return this.quotesService.createQuote(id, dto, req.user.id);
  }

  @Get('job-requests/:id/quotes')
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  findQuotesForJobRequest(@Param('id') id: string) {
    return this.quotesService.findQuotesForJobRequest(id);
  }

  @Get('quotes/provider/me')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  findMyQuotes(@Req() req: AuthRequest) {
    return this.quotesService.findMyQuotes(req.user.id);
  }

  @Patch('quotes/:id')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  updateQuote(
    @Param('id') id: string,
    @Body() dto: UpdateQuoteDto,
    @Req() req: AuthRequest,
  ) {
    return this.quotesService.updateQuote(id, dto, req.user.id);
  }

  @Delete('quotes/:id')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  withdrawQuote(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.quotesService.withdrawQuote(id, req.user.id);
  }

  @Post('quotes/:id/accept')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  acceptQuote(
    @Param('id') id: string,
    @Body() body: { promoCode?: string },
    @Req() req: AuthRequest,
  ) {
    return this.quotesService.acceptQuote(id, req.user.id, body.promoCode);
  }
}
