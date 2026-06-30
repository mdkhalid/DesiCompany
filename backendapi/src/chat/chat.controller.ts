import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { TranslationService, SupportedLanguage } from './translation.service';
import { MessageType } from './entities/message.entity';
import { DirectMessageType } from './entities/direct-message.entity';

interface AuthRequest {
  user: { id: string; role: string };
}

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard, JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly translationService: TranslationService,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations for current user' })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async getConversations(
    @Req() req: AuthRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.chatService.getConversations(req.user.id, page, limit);
  }

  @Get('messages/:type/:targetId')
  @ApiOperation({ summary: 'Get message history for a conversation' })
  @ApiResponse({ status: 200, description: 'Message history' })
  async getMessageHistory(
    @Req() req: AuthRequest,
    @Param('type') type: 'booking' | 'direct',
    @Param('targetId') targetId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.chatService.getMessageHistory(req.user.id, type, targetId, page, limit);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  async sendMessage(
    @Req() req: AuthRequest,
    @Body()
    body: {
      type?: 'booking' | 'direct';
      bookingId?: string;
      providerId?: string;
      content: string;
      messageType?: string;
      metadata?: Record<string, any>;
    },
  ) {
    let conversationType: 'booking' | 'direct' = body.type || 'booking';
    let targetId: string;

    if (conversationType === 'booking') {
      if (!body.bookingId) {
        throw new Error('bookingId is required for booking-based messages');
      }
      targetId = body.bookingId;
    } else {
      if (!body.providerId) {
        throw new Error('providerId is required for direct messages');
      }
      // Create direct chat room ID
      const user = await this.chatService.getConversations(req.user.id, 1, 1);
      targetId = `direct_${req.user.id}_${body.providerId}`;
      conversationType = 'direct';
    }

    const messageType = body.messageType || 'text';
    const message = await this.chatService.sendMessage(
      req.user.id,
      conversationType,
      targetId,
      body.content,
      messageType,
      body.metadata,
    );

    return { message, success: true };
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Patch('messages/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark messages as read' })
  async markAsRead(
    @Req() req: AuthRequest,
    @Body()
    body: {
      type: 'booking' | 'direct';
      targetId: string;
    },
  ) {
    await this.chatService.markAsRead(req.user.id, body.type, body.targetId);
    return { success: true };
  }

  @Post('translate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Translate message to target language' })
  async translate(
    @Body()
    body: {
      text: string;
      targetLang: string;
    },
  ) {
    return this.translationService.translate(
      body.text,
      body.targetLang as SupportedLanguage,
    );
  }

  @Post('translate/detect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Detect language of text' })
  detectLanguage(@Body('text') text: string) {
    return { language: this.translationService.detectLanguage(text) };
  }
}