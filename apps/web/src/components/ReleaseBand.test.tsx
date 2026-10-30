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

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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
});
