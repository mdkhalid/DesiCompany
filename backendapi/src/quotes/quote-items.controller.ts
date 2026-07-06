import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { QuoteItemsService } from './quote-items.service';
import { CreateQuoteItemDto } from './dto/create-quote-item.dto';
import { UpdateQuoteItemDto } from './dto/update-quote-item.dto';

interface AuthRequest {
  user: { id: string; role: UserRole };
}

@ApiTags('Quote Items')
@ApiBearerAuth()
@Controller('quotes/:quoteId/items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteItemsController {
  constructor(private readonly quoteItemsService: QuoteItemsService) {}

  @Post()
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Add an itemized line to a quote' })
  create(
    @Param('quoteId') quoteId: string,
    @Body() dto: CreateQuoteItemDto,
    @Req() req: AuthRequest,
  ) {
    return this.quoteItemsService.create(quoteId, dto, req.user.id);
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.PROVIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all items for a quote' })
  findAll(@Param('quoteId') quoteId: string) {
    return this.quoteItemsService.findAll(quoteId);
  }

  @Patch(':itemId')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Update a quote item' })
  update(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateQuoteItemDto,
    @Req() req: AuthRequest,
  ) {
    return this.quoteItemsService.update(itemId, dto, req.user.id);
  }

  @Delete(':itemId')
  @Roles(UserRole.PROVIDER)
  @ApiOperation({ summary: 'Delete a quote item' })
  remove(@Param('itemId') itemId: string, @Req() req: AuthRequest) {
    return this.quoteItemsService.remove(itemId, req.user.id);
  }
}
