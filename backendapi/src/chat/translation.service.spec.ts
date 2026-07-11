import { TranslationService, SupportedLanguage } from './translation.service';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    service = new TranslationService();
  });

  afterEach(() => jest.clearAllMocks());

  describe('detectLanguage', () => {
    it('should detect English text', () => {
      expect(service.detectLanguage('Hello')).toBe(SupportedLanguage.EN);
    });

    it('should detect Hindi text', () => {
      expect(service.detectLanguage('नमस्ते')).toBe(SupportedLanguage.HI);
    });

    it('should detect English for empty string', () => {
      expect(service.detectLanguage('')).toBe(SupportedLanguage.EN);
    });
  });

  describe('translate', () => {
    it('should return original text for empty input', () => {
      const result = service.translate('', SupportedLanguage.HI);
      expect(result.original).toBe('');
      expect(result.translated).toBe('');
      expect(result.sourceLang).toBe('unknown');
    });

    it('should return original text when source equals target', () => {
      const result = service.translate('Hello', SupportedLanguage.EN);
      expect(result.translated).toBe('Hello');
      expect(result.sourceLang).toBe(SupportedLanguage.EN);
      expect(result.targetLang).toBe(SupportedLanguage.EN);
    });

    it('should translate known English to Hindi', () => {
      const result = service.translate('Hello', SupportedLanguage.HI);
      expect(result.translated).toBe('नमस्ते');
      expect(result.sourceLang).toBe(SupportedLanguage.EN);
      expect(result.targetLang).toBe(SupportedLanguage.HI);
    });

    it('should translate known Hindi to English', () => {
      const result = service.translate('नमस्ते', SupportedLanguage.EN);
      expect(result.translated).toBe('Hello');
      expect(result.sourceLang).toBe(SupportedLanguage.HI);
    });

    it('should use placeholder for unknown English text to Hindi', () => {
      const result = service.translate('Random text', SupportedLanguage.HI);
      expect(result.translated).toBe('[HI] Random text');
    });

    it('should use placeholder for unknown Hindi text to English', () => {
      const result = service.translate('अज्ञात पाठ', SupportedLanguage.EN);
      expect(result.translated).toBe('[EN] अज्ञात पाठ');
    });

    it('should handle whitespace-only text as empty', () => {
      const result = service.translate('   ', SupportedLanguage.HI);
      expect(result.sourceLang).toBe('unknown');
      expect(result.translated).toBe('   ');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return en and hi', () => {
      const langs = service.getSupportedLanguages();
      expect(langs).toContain(SupportedLanguage.EN);
      expect(langs).toContain(SupportedLanguage.HI);
      expect(langs).toHaveLength(2);
    });
  });
});
