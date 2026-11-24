/** Why a filter hid a tweet. The stub shows it as "Tweet hidden — {filter}: {reason}". */
export interface HideReason {
  filter: 'language' | 'keyword';
  reason: string;
}
