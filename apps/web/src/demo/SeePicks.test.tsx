import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { CW, coursesAt } from './menuCourses.ts';
import { type PicksStateName, SW, picksAt } from './seePicks.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function open(to: string, title: string) {
  cleanup();
  const router = createMemoryRouter(routes, { initialEntries: [to] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: title }, WAIT);
}

const picks = (state: PicksStateName) => open(picksAt(state), SW.title);
const region = (name: string): HTMLElement => screen.getByRole('region', { name });
const said = (): string => document.querySelector('.pk-said')?.textContent ?? '';

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('See picks (sc-3909)', () => {
  it(
    'shows the header, Needs the host first, a card per course and Who hasn’t picked',
    SLOW,
    async () => {
      await picks('picks');

      expect(screen.getByText('39 of 48 picks in · 81% of the room')).toBeTruthy();
      const host = region(SW.needsHost);
      expect(within(host).getAllByText('Kwame Asante')).toHaveLength(2);
      expect(within(host).getAllByText('Elena Rossi')).toHaveLength(2);
      expect(within(host).getByText(/Dessert: their pick, Chin chin, contains milk/)).toBeTruthy();
      expect(within(host).getAllByText(SW.nothingFor('Starter'))).toHaveLength(3);
      expect(screen.queryByText(SW.allIn)).toBeNull();
      expect(
        within(region('Starter')).getByText(SW.asksNothing('Catfish pepper soup')),
      ).toBeTruthy();
      expect(within(region('Main')).getAllByRole('table')).toHaveLength(2);
      expect(within(region('Main')).queryByRole('columnheader', { name: SW.defaulted })).toBeNull();
      expect(
        within(region(SW.whoHasnt)).getByText('Replied by Bea Mensah · 3 people'),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Choose for Bea Mensah' })).toBeTruthy();
    },
  );

  it(
    'shows names without Choose for them on Guests read, and counts only without it',
    SLOW,
    async () => {
      await picks('picksReadOnly');
      expect(screen.queryByRole('button', { name: /^Choose for / })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Choose who gets / })).toBeNull();
      expect(screen.getByText(SW.needsManage)).toBeTruthy();

      await picks('picksCountsOnly');
      expect(within(region(SW.needsHost)).getByText('Main · 2 people')).toBeTruthy();
      expect(within(region(SW.needsHost)).getByText('Starter · 3 people')).toBeTruthy();
      expect(screen.queryByText('Kwame Asante')).toBeNull();
      expect(screen.queryByRole('region', { name: SW.whoHasnt })).toBeNull();
    },
  );

  it('shows Defaulted only on a course where someone was defaulted', SLOW, async () => {
    await picks('picksAllIn');
    expect(screen.getByText(SW.allIn)).toBeTruthy();
    expect(
      within(region('Dessert')).getByRole('columnheader', { name: SW.defaulted }),
    ).toBeTruthy();
    expect(
      within(region('Starter')).queryByRole('columnheader', { name: SW.defaulted }),
    ).toBeNull();
  });

  it('refuses Save with nothing picked, in place', SLOW, async () => {
    await picks('chooseForBlank');
    expect(screen.getByText('Choose main for Bea Mensah, or let the kitchen choose.')).toBeTruthy();
  });

  it('asks the override question, and records the pick as the host’s', SLOW, async () => {
    await picks('chooseForOverride');
    const ask = screen.getByRole('alertdialog');
    expect(
      within(ask).getByText('Kwame Asante’s record says celery. Pick it anyway?'),
    ).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.textContent).toBe(SW.chooseAnother));

    fireEvent.click(within(ask).getByRole('button', { name: SW.pickAnyway }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(said()).toContain('Recorded as your pick for Kwame Asante, despite the record');
    expect(screen.getByText('40 of 48 picks in · 83% of the room')).toBeTruthy();
  });

  it('says a 403 and saves nothing', SLOW, async () => {
    await picks('chooseForRefused');
    expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toContain(
      'your role no longer has Guests manage',
    );
    expect(screen.queryByRole('button', { name: SW.save })).toBeNull();
  });

  it('gives a Children only variant with Choose who gets it, and takes it back', SLOW, async () => {
    await picks('chooseWhoStarter');
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Sasha Petrova' }));
    expect(within(dialog).getByText('Goes back to Full bowl.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Bea Mensah' }));
    fireEvent.click(within(dialog).getByRole('button', { name: SW.save }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(said()).toContain('Children’s portion, Catfish pepper soup: 3 people now.');
  });

  it('chooses for Elena on the starter, which asks guests nothing', SLOW, async () => {
    await picks('chooseForStarter');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Starter · 1 of 1')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('radio', { name: SW.kitchenChoose }));
    fireEvent.click(within(dialog).getByRole('button', { name: SW.save }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(said()).toContain('Starter chosen for Elena');
    expect(within(region(SW.needsHost)).getAllByText(SW.nothingFor('Starter'))).toHaveLength(2);
  });

  it(
    'lists Menu changed under the party, and chooses for them on the changed course (sc-3913)',
    SLOW,
    async () => {
      await picks('picksMenuChanged');
      const waiting = region(SW.whoHasnt);
      expect(within(waiting).getAllByText(SW.changedOn('Dessert', 'Puff puff'))).toHaveLength(3);
      expect(within(waiting).getByText('Replied by Mateo Ruiz · 1 person')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Choose for Lucía Ruiz' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Dessert · 1 of 1')).toBeTruthy();
      fireEvent.click(within(dialog).getByRole('radio', { name: SW.kitchenChoose }));
      fireEvent.click(within(dialog).getByRole('button', { name: SW.save }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(
        within(region(SW.whoHasnt)).getAllByText(SW.changedOn('Dessert', 'Puff puff')),
      ).toHaveLength(2);
    },
  );

  it('asks before giving a variant to someone it rules out', SLOW, async () => {
    await picks('chooseWhoOverride');
    expect(
      within(screen.getByRole('alertdialog')).getByText(
        'Kojo Asante: give Children’s portion anyway?',
      ),
    ).toBeTruthy();
  });
});

describe('the picks on the Menu’s rows (sc-3909)', () => {
  it(
    'shows each dish’s and variant’s picks from See picks’ figures, and See picks on each course',
    SLOW,
    async () => {
      await open(coursesAt('menuPicks'), CW.title);

      expect(screen.getByText('17 picks · 35% of the room')).toBeTruthy();
      expect(screen.getAllByRole('link', { name: /^See picks · / }).length).toBe(3);
      const summary = screen.getByRole('complementary', { name: SW.summaryTitle });
      expect(within(summary).getByText('Picks close Monday, Oct 19.')).toBeTruthy();
      expect(screen.getByText('picks close Monday, Oct 19')).toBeTruthy();
    },
  );
});

describe('a course’s default on See picks (sc-1362)', () => {
  it('shows Defaulted, the default’s line and Given the default after its date', SLOW, async () => {
    await picks('picksDefaultAfter');
    const main = region('Main');
    expect(within(main).getByRole('columnheader', { name: SW.defaulted })).toBeTruthy();
    expect(
      within(main).getByText(
        '[Default: Jollof rice, Chicken. Given on Friday, Oct 16 to 2 guests who hadn’t answered.]',
      ),
    ).toBeTruthy();
    const waiting = region(SW.whoHasnt);
    expect(within(waiting).getByText(SW.neverGiven(3))).toBeTruthy();
    expect(within(waiting).getByText('Not chosen: Main · allergy')).toBeTruthy();
    const given = region(SW.given(2));
    expect(within(given).getByText('Kofi Mensah')).toBeTruthy();
    expect(within(given).getByRole('button', { name: 'Choose for Kofi Mensah' })).toBeTruthy();
  });

  it('moves Kofi from Given the default to chosen once chosen for', SLOW, async () => {
    await picks('chooseForDefaultedSaved');
    expect(said()).toContain('Main chosen for Kofi Mensah: Suya wrap, Beef.');
    expect(within(region(SW.given(1))).queryByText('Kofi Mensah')).toBeNull();
  });

  it('opens Choose for them at the default', SLOW, async () => {
    await picks('chooseForDefaulted');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Main · 1 of 1')).toBeTruthy();
    expect(
      (within(dialog).getByRole('radio', { name: /^Jollof rice/ }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('lists names without Choose for them on Guests read', SLOW, async () => {
    await picks('picksDefaultReadOnly');
    expect(within(region(SW.given(2))).getByText('Ivan Petrov')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Choose for / })).toBeNull();
  });
});
