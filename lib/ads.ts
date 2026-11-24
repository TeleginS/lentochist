/**
 * Ad removal: takes ads out of the feed with no stub, wherever X shows tweets.
 *
 * X runs two web UIs. The old one ("rweb") uses data-testid attributes; the
 * new one ("xweb") renders timeline rows as `[id^="urt:"] > ul > li[data-index]`
 * with no test ids. Markers follow Control Panel for Twitter and EasyList.
 *
 * Nothing is removed from the DOM: X virtualizes the timeline and reuses rows,
 * so we only toggle classes and re-check on every scan.
 */

const AD_CLASS = 'lentochist-ad';
const AD_ROW_CLASS = 'lentochist-ad-row';

export const AD_STYLES = `
.${AD_CLASS} { display: none !important; }
.${AD_CLASS} + [role="separator"] { display: none !important; }
.${AD_ROW_CLASS} {
  height: 1px !important;
  min-height: 1px !important;
  overflow: hidden !important;
  border: 0 !important;
}
`;

/** End of the SVG path of X's "promoted" icon in the old UI. */
const PROMOTED_ICON_PATH_END = '10H8.996V8h7v7z';

/** "Ad from {url}" on card ads in the new UI, per language. */
const AD_FROM = /^(Ad from|Реклама от|Реклама від|Anzeige von|Publicité de|Anuncio de|Annuncio di|Anúncio de|Reklama od|Reklam:)\s/i;

const PROFILE_PATH = /^\/\w{1,20}$/;

// --- Old UI ---

/** A tweet inside X's ad placement wrapper. Language-independent. */
export function isRwebAdTweet(article: Element): boolean {
  return article.closest('[data-testid="placementTracking"]') !== null;
}

function hasPromotedIcon(el: Element): boolean {
  return [...el.querySelectorAll('svg path')].some((p) => p.getAttribute('d')?.endsWith(PROMOTED_ICON_PATH_END));
}

/** Elements to hide in the old UI: the content of ad cells, and promoted "Who to follow" accounts. */
export function findRwebAds(root: ParentNode): Element[] {
  const found = new Set<Element>();
  for (const placement of root.querySelectorAll('[data-testid="placementTracking"]')) {
    // Hide the cell's content, not the cell, so the virtual list keeps its slot.
    const cell = placement.closest('[data-testid="cellInnerDiv"]');
    found.add(cell?.firstElementChild ?? placement);
  }
  for (const user of root.querySelectorAll('[data-testid="UserCell"]')) {
    if (hasPromotedIcon(user)) found.add(user);
  }
  return [...found];
}

// --- New UI ---

/** Whether a new-UI timeline row holds an ad. */
export function isXwebAdRow(row: Element): boolean {
  // The "Ad" disclosure: a link to the advertiser's profile right before the "More" button.
  for (const use of row.querySelectorAll('button use')) {
    if (use.getAttribute('href') !== '#icon-more-dots-hor') continue;
    const link = use.closest('button')?.previousElementSibling;
    if (link?.matches('a[href]') && PROFILE_PATH.test(link.getAttribute('href') ?? '')) return true;
  }
  if (row.querySelector('[class*="data-ad-disclosure"], a[target="_blank"][href*="?twclid="]')) return true;
  // Boosted posts and paid partnerships.
  if (row.querySelector('[data-icon="icon-rocket"]')) return true;
  if (row.querySelector('a[href$="/rules-and-policies/paid-partnerships-policy"] [data-icon="icon-promoted-square-fill"]')) {
    return true;
  }
  // Card ads: "Ad from example.com".
  return [...row.querySelectorAll('a[target="_blank"]')].some((a) => AD_FROM.test(a.textContent?.trim() ?? ''));
}

export function findXwebAdRows(root: ParentNode): Element[] {
  return [...root.querySelectorAll('[id^="urt:"] > ul > li[data-index]')].filter(isXwebAdRow);
}

// --- Applying ---

/** Marks every ad on the page and unmarks elements that no longer hold one (rows get reused). */
export function applyAdRemoval(root: ParentNode, enabled: boolean): void {
  const ads = new Set(enabled ? findRwebAds(root) : []);
  const rows = new Set(enabled ? findXwebAdRows(root) : []);

  for (const el of root.querySelectorAll(`.${AD_CLASS}`)) if (!ads.has(el)) el.classList.remove(AD_CLASS);
  for (const el of root.querySelectorAll(`.${AD_ROW_CLASS}`)) if (!rows.has(el)) el.classList.remove(AD_ROW_CLASS);

  for (const el of ads) el.classList.add(AD_CLASS);
  // Collapse rather than hide new-UI rows: display:none or zero height confuses X's virtual list.
  for (const row of rows) row.classList.add(AD_ROW_CLASS);
}
