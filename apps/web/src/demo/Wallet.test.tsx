import { render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { NAMES } from './wallet.ts';

const SLOW = { timeout: 15000 };
const tested = config();

async function open(path: string, landmark: 'banner' | 'navigation' = 'banner') {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  if (landmark === 'banner') await screen.findByRole('banner');
  else await screen.findAllByRole('navigation');
}

const main = () => document.querySelector('main') as HTMLElement;
const LINE = 'Open this page on your phone to save it to your wallet.';

let fetching: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
  fetching = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  expect(fetching).not.toHaveBeenCalled();
  fetching.mockRestore();
});

describe('the wallet button on the guest page (sc-9956)', () => {
  it('shows Apple’s badge as a link on an iPhone, inside the code card', SLOW, async () => {
    await open('/demo/guest?state=coming&wallet=ios');

    const badge = within(main()).getByRole('link', { name: 'Add to Apple Wallet' });
    expect(badge.closest('section')?.getAttribute('aria-labelledby')).toBe('gp-door');
    expect(within(main()).queryByRole('link', { name: 'Add to Google Wallet' })).toBeNull();
    expect(within(main()).queryByText(LINE)).toBeNull();
  });

  it('shows Google’s button on an Android phone', SLOW, async () => {
    await open('/demo/guest?state=coming&wallet=android');

    expect(within(main()).getByRole('link', { name: 'Add to Google Wallet' })).toBeTruthy();
    expect(within(main()).queryByRole('link', { name: 'Add to Apple Wallet' })).toBeNull();
  });

  it('shows the line and no button on a computer or tablet', SLOW, async () => {
    await open('/demo/guest?state=coming&wallet=desktop');

    expect(within(main()).getByText(LINE)).toBeTruthy();
    expect(within(main()).queryByRole('link', { name: /Wallet/u })).toBeNull();
  });

  it('shows on the event’s day too, in the card that leads', SLOW, async () => {
    await open('/demo/guest?state=onTheDay&wallet=ios');

    expect(within(main()).getByRole('link', { name: 'Add to Apple Wallet' })).toBeTruthy();
  });

  it('is gone with the card for a guest who is not Coming', SLOW, async () => {
    for (const path of [
      '/demo/guest?state=notComing&wallet=ios',
      '/demo/guest?state=notSure&wallet=desktop',
    ]) {
      const { unmount } = render(
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />,
      );
      await screen.findByRole('banner');
      expect(within(main()).queryByRole('link', { name: /Wallet/u })).toBeNull();
      expect(within(main()).queryByText(LINE)).toBeNull();
      unmount();
    }
  });

  it('hides the artwork from assistive tech', SLOW, async () => {
    await open('/demo/guest?state=coming&wallet=android');

    const badge = within(main()).getByRole('link', { name: 'Add to Google Wallet' });
    expect(badge.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('the pass faces (sc-9956)', () => {
  it(
    'draws Apple’s front with Soirely, the event, the guest, the door words and the code, and no link',
    SLOW,
    async () => {
      await open('/demo/wallet-pass?face=apple', 'navigation');

      const pass = screen.getByRole('region', { name: 'Apple Wallet pass, front' });
      expect(within(pass).getByText('Soirely')).toBeTruthy();
      expect(pass.textContent).toContain(NAMES.page.event);
      expect(pass.textContent).toContain(NAMES.page.guest);
      expect(within(pass).getByText('Show this at the door')).toBeTruthy();
      expect(within(pass).queryAllByRole('link')).toHaveLength(0);
      expect(pass.querySelector('svg.wl-qr')).not.toBeNull();
    },
  );

  it('empties Google’s pass: no names, no code', SLOW, async () => {
    await open('/demo/wallet-pass?face=google-emptied', 'navigation');

    const pass = screen.getByRole('region', { name: 'Google Wallet pass, emptied' });
    expect(within(pass).getByText('This pass is no longer valid')).toBeTruthy();
    expect(within(pass).getByText('Expired')).toBeTruthy();
    expect(pass.textContent).not.toContain(NAMES.page.event);
    expect(pass.textContent).not.toContain(NAMES.page.guest);
    expect(pass.querySelector('svg.wl-qr')).toBeNull();
  });

  it('shows the long name whole on the details', SLOW, async () => {
    await open('/demo/wallet-pass?face=google-details&names=long&lang=pt', 'navigation');

    const pass = screen.getByRole('region', { name: 'Google Wallet pass, details' });
    expect(
      within(pass).getByText('Chief Olusegun Adebayo-Williams and Dr. Funmilayo Adebayo-Williams'),
    ).toBeTruthy();
  });
});
