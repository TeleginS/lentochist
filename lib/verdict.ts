export type FilterName = 'language' | 'keyword' | 'topic' | 'media';

/**
 * Why a filter hid a tweet. The stub shows it as
 * "Tweet hidden — {filter}: {reason}", plus " · {provider}" for AI filters.
 */
export interface HideReason {
  filter: FilterName;
  reason: string;
  provider?: string;
}
