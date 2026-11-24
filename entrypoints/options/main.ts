import { parseKeywords } from '@/lib/keywords';
import { languageName, nativeLanguageName } from '@/lib/languages';
import { APPLE_MODELS, appleFmStatus } from '@/lib/ai/providers/apple-fm';
import { CLEF_MODELS } from '@/lib/ai/providers/cloudflare';
import { nanoStatus } from '@/lib/ai/providers/nano';
import {
  LANGUAGE_CHOICES,
  loadKeys,
  loadSettings,
  MAX_TOPICS,
  parseTopics,
  saveKeys,
  saveSettings,
  type AppleModel,
  type ClefModel,
  type ProviderId,
  type ProviderKeys,
  type Settings,
} from '@/lib/settings';

const settings: Settings = await loadSettings();
const keys: ProviderKeys = await loadKeys();

function save(): void {
  void saveSettings(settings);
  render();
}

function $(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Missing ${selector}`);
  return el;
}

// --- Ads ---

const removeAds = document.querySelector<HTMLInputElement>('[name=removeAds]')!;
removeAds.addEventListener('change', () => {
  settings.ads.remove = removeAds.checked;
  save();
});

// --- 01 Languages ---

const langs = $('#languages');
const langEnabled = langs.querySelector<HTMLInputElement>('[name=enabled]')!;
const modeInputs = langs.querySelectorAll<HTMLInputElement>('[name=mode]');
const confidence = langs.querySelector<HTMLInputElement>('[name=minConfidence]')!;
const grid = $('#languages-grid');

for (const code of LANGUAGE_CHOICES) {
  const label = document.createElement('label');
  label.className = 'lang';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = code;
  input.addEventListener('change', () => {
    const selected = new Set(settings.languages.selected);
    if (input.checked) selected.add(code);
    else selected.delete(code);
    settings.languages.selected = LANGUAGE_CHOICES.filter((c) => selected.has(c));
    save();
  });
  const name = document.createElement('span');
  name.textContent = nativeLanguageName(code);
  name.lang = code;
  label.append(input, name);
  grid.append(label);
}

langEnabled.addEventListener('change', () => {
  settings.languages.enabled = langEnabled.checked;
  save();
});
for (const input of modeInputs) {
  input.addEventListener('change', () => {
    settings.languages.mode = input.value as Settings['languages']['mode'];
    save();
  });
}
confidence.addEventListener('input', () => {
  settings.languages.minConfidence = Number(confidence.value);
  save();
});

// --- 02 Keywords ---

const kw = $('#keywords');
const kwEnabled = kw.querySelector<HTMLInputElement>('[name=enabled]')!;
const kwList = kw.querySelector<HTMLTextAreaElement>('[name=list]')!;
const kwErrors = $('#keywords-errors');

kwEnabled.addEventListener('change', () => {
  settings.keywords.enabled = kwEnabled.checked;
  save();
});
let typing: ReturnType<typeof setTimeout> | undefined;
kwList.addEventListener('input', () => {
  clearTimeout(typing);
  typing = setTimeout(() => {
    settings.keywords.list = kwList.value;
    save();
  }, 400);
});

// --- 03 Topics, 04 Media ---

const topicsCard = $('#topics');
const topicsEnabled = topicsCard.querySelector<HTMLInputElement>('[name=enabled]')!;
const topicsList = topicsCard.querySelector<HTMLTextAreaElement>('[name=list]')!;
const topicsThreshold = topicsCard.querySelector<HTMLInputElement>('[name=threshold]')!;

topicsEnabled.addEventListener('change', () => {
  settings.topics.enabled = topicsEnabled.checked;
  save();
});
let typingTopics: ReturnType<typeof setTimeout> | undefined;
topicsList.addEventListener('input', () => {
  clearTimeout(typingTopics);
  typingTopics = setTimeout(() => {
    settings.topics.list = topicsList.value;
    save();
  }, 600);
});
topicsThreshold.addEventListener('input', () => {
  settings.topics.threshold = Number(topicsThreshold.value);
  save();
});

const mediaCard = $('#media');
const mediaEnabled = mediaCard.querySelector<HTMLInputElement>('[name=enabled]')!;
const mediaThreshold = mediaCard.querySelector<HTMLInputElement>('[name=threshold]')!;
const mediaPreview = mediaCard.querySelector<HTMLInputElement>('[name=sendPreview]')!;

mediaEnabled.addEventListener('change', () => {
  settings.media.enabled = mediaEnabled.checked;
  save();
});
mediaThreshold.addEventListener('input', () => {
  settings.media.threshold = Number(mediaThreshold.value);
  save();
});
mediaPreview.addEventListener('change', () => {
  settings.media.sendPreview = mediaPreview.checked;
  save();
});

// --- 05 Providers ---

const PROVIDER_NAMES: Record<ProviderId, string> = {
  local: 'Local model (Apple FM or Gemini Nano)',
  cloudflare: 'Cloudflare Workers AI (Clef)',
  jev: 'JEV',
};
const providersList = $('#providers-list');
const providerItems = new Map<ProviderId, HTMLLIElement>();

for (const id of settings.providers.order) {
  const li = document.createElement('li');
  li.className = 'provider';
  li.dataset.id = id;
  li.innerHTML = `
    <div class="provider__head">
      <span class="provider__rank"></span>
      <b></b>
      <button type="button" class="icon-button" data-move="-1" aria-label="Move up">↑</button>
      <button type="button" class="icon-button" data-move="1" aria-label="Move down">↓</button>
      <label class="switch"><input type="checkbox" /><span></span></label>
    </div>`;
  li.querySelector('b')!.textContent = PROVIDER_NAMES[id];
  li.append(document.querySelector<HTMLTemplateElement>(`#provider-${id}`)!.content.cloneNode(true));

  li.querySelector<HTMLInputElement>('.switch input')!.addEventListener('change', (e) => {
    settings.providers.enabled[id] = (e.target as HTMLInputElement).checked;
    save();
  });
  for (const button of li.querySelectorAll<HTMLButtonElement>('[data-move]')) {
    button.addEventListener('click', () => {
      const order = settings.providers.order;
      const from = order.indexOf(id);
      const to = from + Number(button.dataset.move);
      if (to < 0 || to >= order.length) return;
      [order[from], order[to]] = [order[to]!, order[from]!];
      save();
    });
  }
  let typingKey: ReturnType<typeof setTimeout> | undefined;
  for (const input of li.querySelectorAll<HTMLInputElement>('[data-key]')) {
    const field = input.dataset.key as keyof ProviderKeys;
    input.value = keys[field];
    input.addEventListener('input', () => {
      keys[field] = input.value.trim();
      clearTimeout(typingKey);
      typingKey = setTimeout(() => void saveKeys(keys), 400);
    });
  }
  const modelSelect = li.querySelector<HTMLSelectElement>('[data-setting=cloudflareModel]');
  if (modelSelect) {
    for (const [value, label] of Object.entries(CLEF_MODELS)) modelSelect.add(new Option(label, value));
    modelSelect.value = settings.providers.cloudflareModel;
    modelSelect.addEventListener('change', () => {
      settings.providers.cloudflareModel = modelSelect.value as ClefModel;
      save();
    });
  }
  const appleSelect = li.querySelector<HTMLSelectElement>('[data-setting=appleModel]');
  if (appleSelect) {
    for (const [value, label] of Object.entries(APPLE_MODELS)) appleSelect.add(new Option(label, value));
    appleSelect.value = settings.providers.appleModel;
    appleSelect.addEventListener('change', () => {
      settings.providers.appleModel = appleSelect.value as AppleModel;
      save();
      void refreshLocalStatus();
    });
  }
  providerItems.set(id, li);
  providersList.append(li);
}

function setStatus(name: string, ok: boolean | null, text: string): void {
  const el = providersList.querySelector<HTMLElement>(`[data-status=${name}]`)!;
  el.textContent = text;
  el.classList.toggle('ok', ok === true);
  el.classList.toggle('warn', ok === false);
}

async function refreshLocalStatus(): Promise<void> {
  const model = settings.providers.appleModel;
  const name = model === 'pcc' ? 'Apple PCC' : 'Apple FM';
  setStatus('fm', null, `${name}: checking…`);
  const reply = await appleFmStatus();
  const fm = reply[model];
  if (reply.error || !fm) setStatus('fm', false, `${name}: helper not installed`);
  else if (!fm.available) setStatus('fm', false, `${name}: unavailable (${fm.reason ?? 'unknown'})`);
  else setStatus('fm', true, `${name}: ready${fm.images ? ', reads images' : ', text only'}`);

  const nano = await nanoStatus();
  const nanoImages = nano === 'available' && (await nanoStatus(true)) === 'available';
  const download = providersList.querySelector<HTMLButtonElement>('[data-action=download-nano]')!;
  download.hidden = nano !== 'downloadable';
  setStatus(
    'nano',
    nano === 'available' ? true : false,
    {
      available: `Gemini Nano: ready${nanoImages ? ', reads images' : ', text only'}`,
      downloadable: 'Gemini Nano: not downloaded yet',
      downloading: 'Gemini Nano: downloading…',
      unavailable: 'Gemini Nano: not supported in this Chrome or on this device',
    }[nano] ?? `Gemini Nano: ${nano}`,
  );
}

providersList.querySelector('[data-action=download-nano]')!.addEventListener('click', async () => {
  const lm = (globalThis as { LanguageModel?: { create(o: object): Promise<{ destroy(): void }> } }).LanguageModel;
  if (!lm) return;
  setStatus('nano', null, 'Gemini Nano: downloading…');
  try {
    const session = await lm.create({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
      monitor(m: EventTarget) {
        m.addEventListener('downloadprogress', (e) => {
          setStatus('nano', null, `Gemini Nano: downloading ${Math.round((e as ProgressEvent).loaded * 100)}%`);
        });
      },
    });
    session.destroy();
  } catch (e) {
    console.warn(e);
  }
  void refreshLocalStatus();
});

void refreshLocalStatus();

// --- Render ---

function render(): void {
  removeAds.checked = settings.ads.remove;
  const l = settings.languages;
  langEnabled.checked = l.enabled;
  langs.classList.toggle('off', !l.enabled);
  for (const input of modeInputs) {
    input.checked = input.value === l.mode;
    input.closest('.mode')!.classList.toggle('active', input.checked);
  }
  for (const input of grid.querySelectorAll<HTMLInputElement>('input')) {
    input.checked = l.selected.includes(input.value);
    input.closest('.lang')!.classList.toggle('active', input.checked);
  }
  $('#languages-question').textContent =
    l.mode === 'hide' ? 'Which languages to hide?' : 'Which languages to keep in the feed?';
  $('#languages-count').textContent = `Selected: ${l.selected.length}`;

  const names = l.selected.map(languageName).join(', ');
  $('#languages-summary').textContent = !l.selected.length
    ? l.mode === 'hide'
      ? 'Nothing selected: no tweets are hidden by language.'
      : 'Nothing selected: every tweet with a detected language is hidden.'
    : l.mode === 'hide'
      ? `Tweets in ${names} are hidden. Everything else stays.`
      : `The feed keeps tweets in ${names}. Everything else is hidden.`;

  confidence.value = String(l.minConfidence);
  $('#confidence-value').textContent = `${Math.round(l.minConfidence * 100)}%`;

  kwEnabled.checked = settings.keywords.enabled;
  kw.classList.toggle('off', !settings.keywords.enabled);
  if (document.activeElement !== kwList) kwList.value = settings.keywords.list;
  const { errors } = parseKeywords(settings.keywords.list);
  kwErrors.hidden = !errors.length;
  kwErrors.textContent = errors.length ? `Invalid regular expressions are ignored: ${errors.join(', ')}` : '';

  const topics = parseTopics(settings.topics.list);
  topicsEnabled.checked = settings.topics.enabled;
  topicsCard.classList.toggle('off', !settings.topics.enabled);
  if (document.activeElement !== topicsList) topicsList.value = settings.topics.list;
  const lines = settings.topics.list.split('\n').filter((l) => l.trim()).length;
  $('#topics-count').textContent =
    lines > MAX_TOPICS
      ? `Up to ${MAX_TOPICS} topics, one per line. Only the first ${MAX_TOPICS} are used.`
      : `Up to ${MAX_TOPICS} topics, one per line. ${topics.length} in use.`;
  topicsThreshold.value = String(settings.topics.threshold);
  $('#topics-threshold-value').textContent = `${Math.round(settings.topics.threshold * 100)}%`;

  mediaEnabled.checked = settings.media.enabled;
  mediaCard.classList.toggle('off', !settings.media.enabled);
  mediaThreshold.value = String(settings.media.threshold);
  $('#media-threshold-value').textContent = `${Math.round(settings.media.threshold * 100)}%`;
  mediaPreview.checked = settings.media.sendPreview;

  settings.providers.order.forEach((id, i) => {
    const li = providerItems.get(id)!;
    providersList.append(li);
    const on = settings.providers.enabled[id];
    li.classList.toggle('off', !on);
    li.querySelector('.provider__rank')!.textContent = String(i + 1).padStart(2, '0');
    li.querySelector<HTMLInputElement>('.switch input')!.checked = on;
    li.querySelector<HTMLButtonElement>('[data-move="-1"]')!.disabled = i === 0;
    li.querySelector<HTMLButtonElement>('[data-move="1"]')!.disabled = i === settings.providers.order.length - 1;
  });
}

render();
