export type LanguageMode = 'hide' | 'keep';

export interface LanguagesSettings {
  enabled: boolean;
  /** `hide`: hide the selected languages. `keep`: hide everything else. */
  mode: LanguageMode;
  /** ISO 639-1 codes. */
  selected: string[];
  /** 0..1. Below this detection confidence a tweet stays visible. */
  minConfidence: number;
}

export interface KeywordsSettings {
  enabled: boolean;
  /** One keyword per line: a plain word/phrase or a `/pattern/flags`. */
  list: string;
}

export interface Settings {
  languages: LanguagesSettings;
  keywords: KeywordsSettings;
}

export const LANGUAGE_CHOICES = [
  'ru', 'en', 'de', 'uk', 'fr',
  'es', 'it', 'pt', 'pl', 'tr',
  'ar', 'zh', 'ja', 'ko', 'hi',
] as const;

export const DEFAULT_SETTINGS: Settings = {
  languages: {
    enabled: false,
    mode: 'keep',
    selected: ['ru', 'en'],
    minConfidence: 0.75,
  },
  keywords: {
    enabled: false,
    list: '',
  },
};

const STORAGE_KEY = 'settings';

export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  return {
    languages: { ...DEFAULT_SETTINGS.languages, ...stored?.languages },
    keywords: { ...DEFAULT_SETTINGS.keywords, ...stored?.keywords },
  };
}

export async function loadSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return mergeSettings(result[STORAGE_KEY] as Partial<Settings> | undefined);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
}

export function onSettingsChanged(callback: (settings: Settings) => void): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && STORAGE_KEY in changes) {
      callback(mergeSettings(changes[STORAGE_KEY].newValue as Partial<Settings>));
    }
  });
}
