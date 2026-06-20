import { Injectable, Logger } from '@nestjs/common';

export enum SupportedLanguage {
  EN = 'en',
  HI = 'hi',
}

export interface TranslationResult {
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  private readonly commonTranslations: Record<string, Record<string, string>> =
    {
      hi: {
        Hello: 'नमस्ते',
        'Thank you': 'धन्यवाद',
        'How much?': 'कितना?',
        'When can you come?': 'आप कब आ सकते हैं?',
        'I am on the way': 'मैं रास्ते में हूँ',
        'Job completed': 'काम पूरा हो गया',
        'Please confirm': 'कृपया पुष्टि करें',
        Yes: 'हाँ',
        No: 'नहीं',
        OK: 'ठीक है',
        'Good morning': 'सुप्रभात',
        'Good evening': 'शुभ संध्या',
        'Where?': 'कहाँ?',
        'Call me': 'मुझे कॉल करें',
        'I am coming': 'मैं आ रहा हूँ',
      },
      en: {
        नमस्ते: 'Hello',
        धन्यवाद: 'Thank you',
        'कितना?': 'How much?',
        'कब आ सकते हैं?': 'When can you come?',
        'मैं रास्ते में हूँ': 'I am on the way',
        'काम पूरा हो गया': 'Job completed',
        'कृपया पुष्टि करें': 'Please confirm',
        हाँ: 'Yes',
        नहीं: 'No',
        'ठीक है': 'OK',
        सुप्रभात: 'Good morning',
        'शुभ संध्या': 'Good evening',
        'कहाँ?': 'Where?',
        'मुझे कॉल करें': 'Call me',
        'मैं आ रहा हूँ': 'I am coming',
      },
    };

  detectLanguage(text: string): SupportedLanguage {
    const hindiPattern = /[\u0900-\u097F]/;
    return hindiPattern.test(text)
      ? SupportedLanguage.HI
      : SupportedLanguage.EN;
  }

  async translate(
    text: string,
    targetLang: SupportedLanguage,
  ): Promise<TranslationResult> {
    if (!text || text.trim().length === 0) {
      return {
        original: text,
        translated: text,
        sourceLang: 'unknown',
        targetLang,
      };
    }

    const sourceLang = this.detectLanguage(text);

    if (sourceLang === targetLang) {
      return { original: text, translated: text, sourceLang, targetLang };
    }

    const lookupTable = this.commonTranslations[targetLang] || {};
    const translated =
      lookupTable[text] || this.placeholderTranslate(text, targetLang);

    return {
      original: text,
      translated,
      sourceLang,
      targetLang,
    };
  }

  private placeholderTranslate(
    text: string,
    targetLang: SupportedLanguage,
  ): string {
    if (targetLang === SupportedLanguage.HI) {
      return `[HI] ${text}`;
    }
    return `[EN] ${text}`;
  }

  getSupportedLanguages(): string[] {
    return Object.values(SupportedLanguage);
  }
}
