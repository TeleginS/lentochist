import type { HideReason } from './verdict';

const STUB_CLASS = 'lentochist-stub';
const hiddenArticles = new Map<HTMLElement, HTMLElement>();

export const STUB_STYLES = `
.${STUB_CLASS} {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(113, 118, 123, 0.3);
  font: 14px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: rgb(113, 118, 123);
}
.${STUB_CLASS}__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.${STUB_CLASS}__show {
  flex: none;
  padding: 6px 16px;
  border: 1px solid rgb(83, 100, 113);
  border-radius: 9999px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.${STUB_CLASS}__show:hover {
  background: rgba(113, 118, 123, 0.15);
}
`;

export function stubText(reason: HideReason): string {
  return `Tweet hidden — ${reason.filter}: ${reason.reason}`;
}

/** Replaces the tweet with a one-line stub. `onShow` runs when the reader reopens it. */
export function hide(article: HTMLElement, reason: HideReason, onShow: () => void): void {
  reveal(article);

  const stub = document.createElement('div');
  stub.className = STUB_CLASS;

  const text = document.createElement('span');
  text.className = `${STUB_CLASS}__text`;
  text.textContent = stubText(reason);
  text.title = text.textContent;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${STUB_CLASS}__show`;
  button.textContent = 'Show';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    reveal(article);
    onShow();
  });

  stub.append(text, button);
  article.before(stub);
  article.style.display = 'none';
  hiddenArticles.set(article, stub);
}

export function reveal(article: HTMLElement): void {
  const stub = hiddenArticles.get(article);
  if (!stub) return;
  stub.remove();
  article.style.removeProperty('display');
  hiddenArticles.delete(article);
}

export function revealAll(): void {
  for (const article of [...hiddenArticles.keys()]) reveal(article);
}

/** Forgets tweets X has removed from the page while virtualizing the feed. */
export function forgetDetached(): void {
  for (const [article, stub] of hiddenArticles) {
    if (!article.isConnected) {
      stub.remove();
      hiddenArticles.delete(article);
    }
  }
}
