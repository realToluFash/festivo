import { act, fireEvent, render, screen } from '@testing-library/react';
import { startTransition, use, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { LinkedNotice } from './LinkedNotice.tsx';

const LINKED = 'soirely.provider.linked';
const NOTICE = 'Apple is now linked to your account. You can sign in with either.';

function suspendingOnce(): { Slow: () => ReactNode; release: () => Promise<void> } {
  let resolve = () => {};
  const ready = new Promise<void>((done) => (resolve = done));

  return {
    Slow: () => {
      use(ready);
      return null;
    },
    release: async () => {
      await act(async () => {
        resolve();
        await ready;
      });
    },
  };
}

describe('the linked notice', () => {
  afterEach(() => sessionStorage.clear());

  it('survives a render that React abandons and restarts', async () => {
    sessionStorage.setItem(LINKED, 'Apple');
    const { Slow, release } = suspendingOnce();
    const { rerender } = render(<></>);

    await act(async () =>
      startTransition(() =>
        rerender(
          <>
            <LinkedNotice />
            <Slow />
          </>,
        ),
      ),
    );
    expect(screen.queryByText(NOTICE), 'the first render never commits').toBeNull();
    expect(sessionStorage.getItem(LINKED), 'an abandoned render leaves it in place').toBe('Apple');

    await release();

    expect(screen.getAllByText(NOTICE)).toHaveLength(1);
    expect(sessionStorage.getItem(LINKED), 'gone once a render showing it commits').toBeNull();
  });

  it('is shown once: not again on the next screen, and Dismiss hides it', () => {
    sessionStorage.setItem(LINKED, 'Google');
    const { unmount } = render(<LinkedNotice />);

    expect(screen.getByRole('status').textContent).toContain('Google is now linked');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
    unmount();

    render(<LinkedNotice />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows nothing when no sign-in linked a provider', () => {
    const { container } = render(<LinkedNotice />);

    expect(container.innerHTML).toBe('');
  });
});
