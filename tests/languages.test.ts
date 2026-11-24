import { describe, expect, it } from 'vitest';
import { baseLanguage, checkLanguage } from '@/lib/languages';
import { DEFAULT_SETTINGS, type LanguagesSettings } from '@/lib/settings';

const settings = (over: Partial<LanguagesSettings>): LanguagesSettings => ({
  ...DEFAULT_SETTINGS.languages,
  enabled: true,
  ...over,
});

describe('languages', () => {
  it('keep mode hides languages outside the selection', () => {
    const s = settings({ mode: 'keep', selected: ['ru', 'en'] });
    expect(checkLanguage({ language: 'ja', confidence: 0.99 }, s)).toEqual({
      filter: 'language',
      reason: 'Japanese (ja)',
    });
    expect(checkLanguage({ language: 'ru', confidence: 0.99 }, s)).toBeNull();
  });

  it('hide mode hides the selected languages', () => {
    const s = settings({ mode: 'hide', selected: ['tr'] });
    expect(checkLanguage({ language: 'tr', confidence: 0.9 }, s)).not.toBeNull();
    expect(checkLanguage({ language: 'en', confidence: 0.9 }, s)).toBeNull();
  });

  it('leaves low-confidence and undetected tweets visible', () => {
    const s = settings({ mode: 'keep', selected: ['en'], minConfidence: 0.75 });
    expect(checkLanguage({ language: 'ja', confidence: 0.6 }, s)).toBeNull();
    expect(checkLanguage(null, s)).toBeNull();
  });

  it('does nothing when disabled', () => {
    const s = settings({ enabled: false, mode: 'keep', selected: [] });
    expect(checkLanguage({ language: 'ja', confidence: 1 }, s)).toBeNull();
  });

  it('reduces regional codes to the base language', () => {
    expect(baseLanguage('zh-TW')).toBe('zh');
    expect(baseLanguage('pt_BR')).toBe('pt');
  });
});
