import snowball from 'snowball-stemmers';
import type { HideReason } from './verdict';

const russian = snowball.newStemmer('russian');
const english = snowball.newStemmer('english');

const CYRILLIC = /\p{Script=Cyrillic}/u;
const LATIN = /\p{Script=Latin}/u;
const WORD = /[\p{L}\p{N}]+/gu;

export type Keyword =
  | { kind: 'regex'; source: string; regex: RegExp }
  | { kind: 'words'; source: string; stems: string[] };

function normalize(word: string): string {
  return word.toLowerCase().replaceAll('ё', 'е');
}

export function stem(word: string): string {
  const w = normalize(word);
  if (CYRILLIC.test(w)) return russian.stem(w);
  if (LATIN.test(w)) return english.stem(w);
  return w;
}

export function stemText(text: string): string[] {
  return (text.match(WORD) ?? []).map(stem);
}

const REGEX_LINE = /^\/(.+)\/([a-z]*)$/;

/** Parses the Keywords textarea. Invalid regexes are returned in `errors`. */
export function parseKeywords(list: string): { keywords: Keyword[]; errors: string[] } {
  const keywords: Keyword[] = [];
  const errors: string[] = [];

  for (const raw of list.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const match = REGEX_LINE.exec(line);
    if (match) {
      const [, pattern = '', rawFlags = ''] = match;
      try {
        // `g` and `y` make RegExp#test stateful between tweets, so drop them.
        const flags = [...new Set(`${rawFlags.replace(/[gy]/g, '')}u`)].join('');
        keywords.push({ kind: 'regex', source: line, regex: new RegExp(pattern, flags) });
      } catch {
        errors.push(line);
      }
      continue;
    }

    const stems = stemText(line);
    if (stems.length) keywords.push({ kind: 'words', source: line, stems });
  }

  return { keywords, errors };
}

function containsSequence(haystack: string[], needle: string[]): boolean {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Returns the first keyword that matches the tweet text. */
export function checkKeywords(text: string, keywords: Keyword[]): HideReason | null {
  if (!keywords.length || !text) return null;
  const stems = stemText(text);

  for (const keyword of keywords) {
    const hit =
      keyword.kind === 'regex'
        ? keyword.regex.test(text)
        : containsSequence(stems, keyword.stems);
    if (hit) return { filter: 'keyword', reason: keyword.source };
  }
  return null;
}
