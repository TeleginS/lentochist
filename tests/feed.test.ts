import { describe, expect, it } from 'vitest';
import { focalTweetId, isFilteredPage } from '@/lib/feed';

describe('feed pages', () => {
  it('filters the home feed, search and threads but not profiles', () => {
    expect(isFilteredPage('/home')).toBe(true);
    expect(isFilteredPage('/search')).toBe(true);
    expect(isFilteredPage('/jack/status/20')).toBe(true);
    expect(isFilteredPage('/jack')).toBe(false);
    expect(isFilteredPage('/jack/with_replies')).toBe(false);
    expect(isFilteredPage('/notifications')).toBe(false);
  });

  it('knows the focal tweet of a thread', () => {
    expect(focalTweetId('/jack/status/20')).toBe('20');
    expect(focalTweetId('/jack/status/20/photo/1')).toBe('20');
    expect(focalTweetId('/home')).toBeNull();
  });
});
