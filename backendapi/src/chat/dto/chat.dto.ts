import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TranslateDto {
  @ApiProperty({ description: 'Text to translate', example: 'Hello' })
  @IsString()
  text: string;

  @ApiProperty({
    description: 'Target language code',
    example: 'hi',
    enum: ['en', 'hi'],
  })
  @IsString()
  targetLang: string;
}

export class DetectLanguageDto {
  @ApiProperty({ description: 'Text to detect language', example: 'नमस्ते' })
  @IsString()
  text: string;
}

export class GetConversationsDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  limit?: number;
}

export class SendMessageDto {
  @ApiPropertyOptional({ description: 'Booking ID (for booking-based chat)' })
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiPropertyOptional({
    description: 'Provider ID (for direct chat)',
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiProperty({
    description: 'Message content',
    example: 'Hello, I need your service',
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: 'Message type',
    example: 'text',
    enum: ['text', 'image', 'quote', 'quick_reply'],
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Metadata (image URL, quote amount, etc.)',
    example: {},
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class MessageAttachmentDto {
  @ApiProperty({
    description: 'Attachment type',
    example: 'image',
    enum: ['image', 'document'],
  })
  @IsString()
  type: string;

  @ApiProperty({
    description: 'File URL',
    example: 'https://storage.example.com/image.jpg',
  })
  @IsString()
  url: string;

  @ApiPropertyOptional({ description: 'Original filename' })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsOptional()
  size?: number;
}

export class TypingStatusDto {
  @ApiPropertyOptional({ description: 'Booking ID for booking-based chat' })
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiPropertyOptional({
    description: 'Room ID for direct chat',
    example: 'direct_customerId_providerId',
  })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiProperty({ description: 'Whether user is typing', example: true })
  isTyping: boolean;
}
