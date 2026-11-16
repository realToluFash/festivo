import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { atPhoneWidth, atWideWidth } from '../test-widths.ts';
import { HW, LONGEST_NAME, forgetAnyway } from './handoff.ts';

const tested = config();
const SLOW = { timeout: 15000 };

async function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, SLOW);

  return router;
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  forgetAnyway();
});

afterEach(() => {
  __setConfig(tested);
  vi.restoreAllMocks();
});

describe('an event’s page in a phone browser (sc-55397)', () => {
  it(
    'hands over: the event, the area, the line and one action, focus on the heading',
    SLOW,
    async () => {
      atPhoneWidth();
      await open('/demo/handoff?state=area&area=seating');

      const heading = screen.getByRole('heading', { level: 1, name: 'Adaeze & Tunde’s wedding' });
      expect(document.activeElement).toBe(heading);
      expect(screen.getByText('Seating')).toBeTruthy();
      expect(screen.getByText(HW.line)).toBeTruthy();
      const main = screen.getByRole('main');
      expect(
        within(main)
          .getAllByRole('button')
          .map((one) => one.textContent),
      ).toEqual([HW.anyway]);
      expect(within(main).queryAllByRole('link')).toHaveLength(0);
      expect(screen.getByRole('link', { name: HW.skip }).getAttribute('href')).toBe('#content');
      expect(heading.id).toBe('content');
    },
  );

  it('shows New event with no event name', SLOW, async () => {
    atPhoneWidth();
    await open('/demo/handoff?state=new');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(HW.newEvent);
  });

  it('names no area on a page that marks none', SLOW, async () => {
    atPhoneWidth();
    await open('/demo/handoff?state=no_area');

    expect(screen.queryByText('Overview')).toBeNull();
  });

  it('keeps a 120-character name whole', SLOW, async () => {
    atPhoneWidth();
    await open('/demo/handoff?state=long&area=seating');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(LONGEST_NAME);
  });

  it('lists the event’s areas in Menu, each opening its handoff', SLOW, async () => {
    atPhoneWidth();
    const router = await open('/demo/handoff?state=area&area=seating');

    fireEvent.click(screen.getByRole('button', { name: HW.menu }));
    const sheet = screen.getByRole('dialog', { name: HW.menu });
    expect(within(sheet).getByRole('link', { name: 'Seating' }).getAttribute('aria-current')).toBe(
      'page',
    );
    fireEvent.click(within(sheet).getByRole('link', { name: 'Guests' }));

    expect(router.state.location.search).toBe('?area=guests');
    expect(await screen.findByText('Guests', { selector: '.ho-area' })).toBeTruthy();
  });

  it('ends Menu as the shell does: Settings, the person, and the language', SLOW, async () => {
    atPhoneWidth();
    const router = await open('/demo/handoff?state=area&area=seating');

    fireEvent.click(screen.getByRole('button', { name: HW.menu }));
    const sheet = screen.getByRole('dialog', { name: HW.menu });
    const picker = within(sheet).getByRole('combobox', { name: HW.language });
    fireEvent.change(picker, { target: { value: 'fr' } });

    expect((picker as HTMLSelectElement).value).toBe('fr');
    expect(screen.getByText(HW.languageSaved)).toBeTruthy();

    fireEvent.click(within(sheet).getByRole('link', { name: /, Owner$/ }));
    expect(router.state.location.pathname).toBe('/demo/settings/account');
  });

  it('shows the page anyway, and every page after it in the tab', SLOW, async () => {
    atPhoneWidth();
    const router = await open('/demo/handoff?state=area&area=seating');

    fireEvent.click(screen.getByRole('button', { name: HW.anyway }));
    expect(router.state.location.pathname).toBe('/demo/events/evt-wed-4/seating');

    await router.navigate('/demo/handoff?area=messages');
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/demo/events/evt-wed-4/messages'),
    );
  });

  it('opens the page itself wider than 640 px', SLOW, async () => {
    atWideWidth();
    const router = await open('/demo/handoff?state=area&area=seating');

    expect(router.state.location.pathname).toBe('/demo/events/evt-wed-4/seating');
  });
});
