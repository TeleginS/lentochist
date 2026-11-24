import { parseKeywords } from '@/lib/keywords';
import { languageName, nativeLanguageName } from '@/lib/languages';
import { LANGUAGE_CHOICES, loadSettings, saveSettings, type Settings } from '@/lib/settings';

const settings: Settings = await loadSettings();

function save(): void {
  void saveSettings(settings);
  render();
}

function $(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Missing ${selector}`);
  return el;
}

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

// --- Render ---

function render(): void {
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
}

render();
