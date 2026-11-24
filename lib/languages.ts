import type { LanguagesSettings } from './settings';
import type { HideReason } from './verdict';

export interface Detection {
  /** Base ISO 639-1 code, e.g. `zh` for `zh-TW`. */
  language: string;
  /** 0..1 */
  confidence: number;
}

const englishNames = new Intl.DisplayNames(['en'], { type: 'language' });

export function languageName(code: string): string {
  return englishNames.of(code) ?? code;
}

export function nativeLanguageName(code: string): string {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
}

export function baseLanguage(code: string): string {
  return code.toLowerCase().split(/[-_]/)[0] ?? code;
}

/** Decides whether a tweet in the detected language must be hidden. */
export function checkLanguage(
  detection: Detection | null,
  settings: LanguagesSettings,
): HideReason | null {
  if (!settings.enabled || !detection) return null;
  if (detection.confidence < settings.minConfidence) return null;

  const selected = settings.selected.includes(detection.language);
  const hide = settings.mode === 'hide' ? selected : !selected;
  if (!hide) return null;

  return {
    filter: 'language',
    reason: `${languageName(detection.language)} (${detection.language})`,
  };
}

/** Detects the main language of a text with Chrome's built-in CLD. */
export async function detectLanguage(text: string): Promise<Detection | null> {
  if (!text.trim()) return null;
  const result = await browser.i18n.detectLanguage(text);
  const top = [...result.languages].sort((a, b) => b.percentage - a.percentage)[0];
  if (!top || top.language === 'und') return null;
  return { language: baseLanguage(top.language), confidence: top.percentage / 100 };
}
