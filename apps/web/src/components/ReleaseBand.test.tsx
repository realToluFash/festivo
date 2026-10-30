import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CHECK_EVERY_MS } from '../release.ts';
import { ReleaseBand } from './ReleaseBand.tsx';

function comeBackIntoView() {
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

function liveRegion(): HTMLElement {
  return document.querySelector<HTMLElement>('[aria-live="polite"]')!;
}

const BAND = 56;

/** Lays the page out as a browser would: the band pushes what follows down unless scroll anchoring has already moved the page. */
function layOut({ scrolled = 0, anchored = false, fieldTop = 400 }) {
  vi.stubGlobal('scrollY', scrolled);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const shown = document.querySelector('.release-band') != null;
    const moved = shown && anchored ? BAND : 0;
    const [top, height] =
      this.querySelector('.release-band-words') != null
        ? [-scrolled - moved, shown ? BAND : 0]
        : [fieldTop + (shown ? BAND : 0) - moved, 40];

    return { top, bottom: top + height } as DOMRect;
  });

  return vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
}

async function showBandWhileTyping() {
  render(
    <>
      <ReleaseBand differs={() => Promise.resolve(true)} />
      <input aria-label="Name" />
    </>,
  );
  screen.getByRole('textbox', { name: 'Name' }).focus();

  comeBackIntoView();
  await screen.findByRole('button', { name: 'Reload' });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ReleaseBand', () => {
  it('shows nothing until a check finds another release, with its live region on the page from load', () => {
    const differs = vi.fn(() => Promise.resolve(true));

    render(<ReleaseBand differs={differs} />);

    expect(liveRegion().textContent).toBe('');
    expect(screen.queryByRole('button')).toBeNull();
    expect(differs).not.toHaveBeenCalled();
  });

  it('shows the band once the tab comes back into view on an older release', async () => {
    render(<ReleaseBand differs={() => Promise.resolve(true)} />);

    comeBackIntoView();

    await screen.findByRole('button', { name: 'Reload' });
    expect(liveRegion().textContent).toBe('Soirely has been updated.');
  });

  it('shows nothing on the deployed release, or when the check cannot finish', async () => {
    for (const answer of [false, null]) {
      const { unmount } = render(<ReleaseBand differs={() => Promise.resolve(answer)} />);

      comeBackIntoView();
      await act(() => Promise.resolve());

      expect(screen.queryByRole('button')).toBeNull();
      unmount();
    }
  });

  it('checks every 30 minutes while in view, and stops once it has found out', async () => {
    vi.useFakeTimers();
    const differs = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);

    render(<ReleaseBand differs={differs} />);

    await act(() => vi.advanceTimersByTimeAsync(CHECK_EVERY_MS));
    expect(differs).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button')).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(CHECK_EVERY_MS));
    screen.getByRole('button', { name: 'Reload' });

    await act(() => vi.advanceTimersByTimeAsync(3 * CHECK_EVERY_MS));
    expect(differs).toHaveBeenCalledTimes(2);
  });

  it('takes no focus and nothing from a field being typed in, and never reloads by itself', async () => {
    vi.useFakeTimers();
    const reload = vi.fn();

    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload });
    render(
      <>
        <ReleaseBand differs={() => Promise.resolve(true)} />
        <input aria-label="Name" />
      </>,
    );
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Name' });

    field.focus();
    fireEvent.change(field, { target: { value: 'Folake' } });
    field.setSelectionRange(2, 4);

    comeBackIntoView();
    await act(() => vi.advanceTimersByTimeAsync(10 * CHECK_EVERY_MS));

    screen.getByRole('button', { name: 'Reload' });
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe('Folake');
    expect(field.selectionStart).toBe(2);
    expect(field.selectionEnd).toBe(4);
    expect(reload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('keeps a page scrolled down where it was, by the band’s height', async () => {
    const scrollBy = layOut({ scrolled: 300 });

    await showBandWhileTyping();

    expect(scrollBy).toHaveBeenCalledExactlyOnceWith(0, BAND);
  });

  it('scrolls nothing where the browser has already anchored the page', async () => {
    const scrollBy = layOut({ scrolled: 300, anchored: true });

    await showBandWhileTyping();

    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('scrolls nothing at the top of the page while the field being typed in stays in view', async () => {
    const scrollBy = layOut({ fieldTop: 400 });

    await showBandWhileTyping();

    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('keeps the field being typed in on screen when the band would push it out of the window', async () => {
    const scrollBy = layOut({ fieldTop: window.innerHeight - 48 });

    await showBandWhileTyping();

    expect(scrollBy).toHaveBeenCalledExactlyOnceWith(0, BAND);
  });
});
