import { describe, expect, it } from 'vitest';
import { checkKeywords, parseKeywords } from '@/lib/keywords';

const check = (list: string, text: string) => checkKeywords(text, parseKeywords(list).keywords);

describe('keywords', () => {
  it('matches other Russian word forms', () => {
    expect(check('кот', 'Смотрите, сколько котов!')).toEqual({ filter: 'keyword', reason: 'кот' });
    expect(check('розыгрыш', 'Участвуйте в розыгрыше iPhone')).not.toBeNull();
    expect(check('криптовалюта', 'Все про криптовалюты')).not.toBeNull();
  });

  it('matches other English word forms', () => {
    expect(check('giveaway', 'Huge GIVEAWAYS today')).not.toBeNull();
    expect(check('run', 'I was running')).not.toBeNull();
  });

  it('treats ё as е', () => {
    expect(check('ёлка', 'новогодние елки')).not.toBeNull();
  });

  it('does not match inside other words', () => {
    expect(check('кот', 'который час')).toBeNull();
    expect(check('art', 'start the party')).toBeNull();
  });

  it('matches phrases as consecutive words', () => {
    expect(check('новый год', 'С новым годом!')).not.toBeNull();
    expect(check('новый год', 'новый прекрасный год')).toBeNull();
  });

  it('supports /regex/ lines', () => {
    expect(check('/\\bnft\\w*/i', 'Mint your NFTs now')).toEqual({ filter: 'keyword', reason: '/\\bnft\\w*/i' });
    expect(check('/^gm$/i', 'GM')).not.toBeNull();
  });

  it('keeps a /g/ regex stable across tweets', () => {
    const { keywords } = parseKeywords('/btc/g');
    expect(checkKeywords('btc', keywords)).not.toBeNull();
    expect(checkKeywords('btc', keywords)).not.toBeNull();
  });

  it('reports invalid regexes and skips blank lines', () => {
    const { keywords, errors } = parseKeywords('\n  \n/(/\nкот\n');
    expect(errors).toEqual(['/(/']);
    expect(keywords).toHaveLength(1);
  });
});
