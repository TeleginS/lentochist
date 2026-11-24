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

export interface TopicsSettings {
  enabled: boolean;
  /** Unwanted topics, one per line, at most MAX_TOPICS. */
  list: string;
  /** 0..1. How sure the model must be that a tweet is about a topic. */
  threshold: number;
}

export interface MediaSettings {
  enabled: boolean;
  threshold: number;
  /** Send a downscaled photo or video frame to the model along with the text. */
  sendPreview: boolean;
}

export type ProviderId = 'local' | 'cloudflare' | 'jev';

export type ClefModel = 'clef-flash' | 'clef' | 'clef-omni';

/** `system`: Apple's on-device model. `pcc`: Apple's server model on Private Cloud Compute. */
export type AppleModel = 'system' | 'pcc';

export interface ProvidersSettings {
  /** The provider chain: tried in this order, disabled ones skipped. */
  order: ProviderId[];
  enabled: Record<ProviderId, boolean>;
  /** Which Clef decision model Cloudflare Workers AI runs. */
  cloudflareModel: ClefModel;
  /** Which Apple Foundation Model the helper runs. */
  appleModel: AppleModel;
}

export interface AdsSettings {
  /** Take ads out of the feed entirely, with no stub. */
  remove: boolean;
}

export interface Settings {
  ads: AdsSettings;
  languages: LanguagesSettings;
  keywords: KeywordsSettings;
  topics: TopicsSettings;
  media: MediaSettings;
  providers: ProvidersSettings;
}

export const MAX_TOPICS = 30;

export function parseTopics(list: string): string[] {
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const raw of list.split('\n')) {
    const topic = raw.trim();
    if (!topic || seen.has(topic.toLowerCase())) continue;
    seen.add(topic.toLowerCase());
    topics.push(topic);
    if (topics.length === MAX_TOPICS) break;
  }
  return topics;
}

export const LANGUAGE_CHOICES = [
  'ru', 'en', 'de', 'uk', 'fr',
  'es', 'it', 'pt', 'pl', 'tr',
  'ar', 'zh', 'ja', 'ko', 'hi',
] as const;

export const DEFAULT_SETTINGS: Settings = {
  ads: {
    remove: true,
  },
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
  topics: {
    enabled: false,
    list: '',
    threshold: 0.8,
  },
  media: {
    enabled: false,
    threshold: 0.85,
    sendPreview: true,
  },
  providers: {
    order: ['local', 'cloudflare', 'jev'],
    enabled: { local: true, cloudflare: true, jev: true },
    cloudflareModel: 'clef-flash',
    appleModel: 'system',
  },
};

const STORAGE_KEY = 'settings';

export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  return {
    ads: { ...DEFAULT_SETTINGS.ads, ...stored?.ads },
    languages: { ...DEFAULT_SETTINGS.languages, ...stored?.languages },
    keywords: { ...DEFAULT_SETTINGS.keywords, ...stored?.keywords },
    topics: { ...DEFAULT_SETTINGS.topics, ...stored?.topics },
    media: { ...DEFAULT_SETTINGS.media, ...stored?.media },
    providers: {
      order: stored?.providers?.order ?? DEFAULT_SETTINGS.providers.order,
      enabled: { ...DEFAULT_SETTINGS.providers.enabled, ...stored?.providers?.enabled },
      cloudflareModel: stored?.providers?.cloudflareModel ?? DEFAULT_SETTINGS.providers.cloudflareModel,
      appleModel: stored?.providers?.appleModel ?? DEFAULT_SETTINGS.providers.appleModel,
    },
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

/** Provider credentials, stored apart from settings so content scripts never need them. */
export interface ProviderKeys {
  cloudflareAccountId: string;
  cloudflareToken: string;
  jevApiKey: string;
}

const KEYS_KEY = 'providerKeys';

export async function loadKeys(): Promise<ProviderKeys> {
  const result = await browser.storage.local.get(KEYS_KEY);
  return {
    cloudflareAccountId: '',
    cloudflareToken: '',
    jevApiKey: '',
    ...(result[KEYS_KEY] as Partial<ProviderKeys> | undefined),
  };
}

export async function saveKeys(keys: ProviderKeys): Promise<void> {
  await browser.storage.local.set({ [KEYS_KEY]: keys });
}
