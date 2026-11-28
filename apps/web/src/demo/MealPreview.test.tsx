import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { PW } from './mealParty.ts';
import { CW, type CoursesStateName, coursesAt } from './menuCourses.ts';
import { SAMPLE } from './rules.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function menu(state: CoursesStateName) {
  cleanup();
  const router = createMemoryRouter(routes, { initialEntries: [coursesAt(state)] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: CW.title }, WAIT);

  return router;
}

const previewLink = () => screen.queryByRole('link', { name: CW.previewAsGuest });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const radio = (name: string | RegExp) => fireEvent.click(screen.getByRole('radio', { name }));

async function openPreview() {
  fireEvent.click(previewLink() as HTMLElement);
  await screen.findByText('For you · Starter · 1 of 3', {}, WAIT);
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('Preview as guest, the way in from the Menu (sc-3907)', () => {
  it('opens the host alone on the first meal screen, and the band closes it', SLOW, async () => {
    const router = await menu('menu');
    await openPreview();
    expect(screen.getByText(PW.preview)).toBeTruthy();
    expect(screen.queryByText(/Chidi Okonkwo-Williams/)).toBeNull();

    click(PW.closePreview);
    await screen.findByRole('heading', { level: 1, name: CW.title }, WAIT);
    expect(router.state.location.search).toContain('state=menu');
    expect(document.getElementById('mc-said')?.textContent).toContain(CW.nothingSaved);
    expect(document.activeElement).toBe(previewLink());
  });

  it('runs every course for the host alone, and Close preview sends nothing', SLOW, async () => {
    await menu('menu');
    await openPreview();
    radio(/Pepper soup/);
    click(PW.next);
    radio(PW.letKitchen);
    click(PW.next);
    radio('No dessert for me');
    click(PW.next);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(PW.check);
    expect(screen.getAllByRole('region', { name: /meals/ })).toHaveLength(1);
    expect(screen.getByText(SAMPLE.name)).toBeTruthy();
    expect(screen.queryByRole('button', { name: PW.send })).toBeNull();
    const actions = screen.getAllByRole('button', { name: PW.closePreview });
    expect(actions).toHaveLength(2);

    fireEvent.click(actions[actions.length - 1] as HTMLElement);
    await screen.findByRole('heading', { level: 1, name: CW.title }, WAIT);
    expect(document.getElementById('mc-said')?.textContent).toContain(CW.nothingSaved);
  });

  it(
    'gives Back from the first meal screen the kitchen note, for the host alone',
    SLOW,
    async () => {
      await menu('menu');
      await openPreview();
      click(PW.back);
      const note = await screen.findByRole('heading', { level: 2, name: PW.kitchenTitle }, WAIT);
      const section = note.closest('section') as HTMLElement;
      expect(within(section).queryByText(/Chidi/)).toBeNull();
    },
  );

  it('shows to a role that can only read the menu', SLOW, async () => {
    await menu('menuPicksReadOnly');
    expect(previewLink()).toBeTruthy();
  });

  it('is not offered with no course that asks guests anything', SLOW, async () => {
    await menu('empty');
    expect(previewLink()).toBeNull();
  });
});
