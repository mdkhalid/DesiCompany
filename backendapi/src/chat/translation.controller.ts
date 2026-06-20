import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TranslationService, SupportedLanguage } from './translation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Translation')
@ApiBearerAuth()
@Controller('translate')
@UseGuards(JwtAuthGuard)
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Post()
  @ApiOperation({ summary: 'Translate text to target language' })
  translate(
    @Body('text') text: string,
    @Body('targetLang') targetLang: SupportedLanguage,
  ) {
    return this.translationService.translate(text, targetLang);
  }

  @Post('detect')
  @ApiOperation({ summary: 'Detect language of text' })
  detect(@Body('text') text: string) {
    return { language: this.translationService.detectLanguage(text) };
  }
}
