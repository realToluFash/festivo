import { createContext } from 'react';

/** Whether the page on screen is still waiting for where it begins to show (components/PageArrival.tsx). */
export const Arriving = createContext(false);

/** Focus lands on the first of these to show, unless the person moves it first. */
export function arriveAt(find: () => HTMLElement | null, done: () => void): () => void {
  const observer = new MutationObserver(attempt);

  function stop(): void {
    observer.disconnect();
    document.removeEventListener('focusin', stop, true);
    document.removeEventListener('pointerdown', stop, true);
    done();
  }

  function attempt(): void {
    const target = find();

    if (target == null) return;

    stop();
    // A heading is not focusable until it is told it may be; -1 keeps it out of the Tab order.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    if (target.getBoundingClientRect().bottom > window.innerHeight) {
      target.scrollIntoView({ block: 'start' });
    }
  }

  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('focusin', stop, true);
  document.addEventListener('pointerdown', stop, true);
  attempt();

  return stop;
}

/** A notice that answers the click, or says the page did not load, comes before the heading. */
export function pageStart(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('[data-page-focus]') ??
    document.querySelector<HTMLElement>('h1')
  );
}

/** Your account's two sections share one heading, so the link that names the section is where it begins. */
export function currentSection(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#content nav [aria-current="page"]');
}

export function sharesHeading(from: string, to: string): boolean {
  return from.startsWith('/app/account') && to.startsWith('/app/account');
}

export function unasked(state: unknown): boolean {
  return typeof state === 'object' && state != null && 'unasked' in state && state.unasked === true;
}

/** A page that opens on its own, such as Sign in after a session ended, says so in its navigation's state. */
export const UNASKED = { unasked: true } as const;

/** The page fades in as it opens, rising when the person goes on and dropping when they go back. */
export function enter(page: HTMLElement | null, back: boolean): void {
  if (page == null) return;

  delete page.dataset.enter;
  void page.offsetWidth; // a reflow, so the same animation starts again on the next page
  page.dataset.enter = back ? 'back' : 'forward';
}
