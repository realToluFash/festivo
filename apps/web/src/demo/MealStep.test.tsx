import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { MSW } from './mealClose.ts';
import { type CloseStateName, MW, PERSON, type MealStateName, mealAt } from './mealStep.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function meal(state: MealStateName | CloseStateName, ready: string = MW.next) {
  cleanup();
  const router = createMemoryRouter(routes, { initialEntries: [mealAt(state)] });
  render(<RouterProvider router={router} />);
  if (ready === MSW.title) await screen.findByRole('heading', { name: ready }, WAIT);
  else await screen.findByRole('button', { name: ready }, WAIT);
}

const next = () => fireEvent.click(screen.getByRole('button', { name: MW.next }));
const heading = () => document.getElementById('ms-h')?.textContent ?? '';

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
});

describe('the meal step on the guest’s page (sc-3904)', () => {
  it('asks the way, then the side, then the sauce, and records them', SLOW, async () => {
    await meal('variant');
    expect(heading()).toBe('Jollof rice · Chicken or Fish?');
    fireEvent.click(screen.getByRole('radio', { name: /Fish/ }));
    next();

    expect(heading()).toBe('Jollof rice · And a side?');
    expect(screen.getByText(MW.pickExactly(1))).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Plantain/ }));
    next();

    expect(heading()).toBe('Jollof rice · And a sauce?');
    fireEvent.click(screen.getByRole('radio', { name: MW.noneForMe }));
    next();

    expect(screen.getByRole('status').textContent).toBe(
      'Main is recorded as chosen: Jollof rice, Fish, Plantain, None for me.',
    );
  });

  it('refuses Next with nothing chosen, and focuses the first option', SLOW, async () => {
    await meal('sideBlank');
    expect(screen.getByRole('alert').textContent).toContain(MW.chooseOne);
    expect(document.activeElement?.getAttribute('type')).toBe('radio');

    await meal('sauceBlank');
    expect(screen.getByRole('alert').textContent).toContain(MW.pickOrNone);

    await meal('setWrongCount');
    expect(screen.getByRole('alert').textContent).toContain('Pick exactly 2. You’ve picked 1.');
  });

  it('greys out a ruled-out option with the reason, and says the host can help', SLOW, async () => {
    await meal('setRuledOut');
    const salad = screen.getByRole('radio', { name: /Garden salad/ }) as HTMLInputElement;
    expect(salad.disabled).toBe(true);
    expect(screen.getAllByText(MW.allergicTo(PERSON, 'mustard'))).toHaveLength(1);
    expect(screen.getByText(MW.hostLine(PERSON))).toBeTruthy();
  });

  it('records needs the host when nothing is safe, with no kitchen choice', SLOW, async () => {
    await meal('setNothingSafe');
    expect(screen.getByText(MW.nothingSafe(PERSON))).toBeTruthy();
    expect(screen.queryByRole('radio', { name: MW.letKitchen })).toBeNull();
    next();
    expect(screen.getByRole('status').textContent).toBe('Main is recorded as needs the host.');
  });

  it('lets the kitchen choose on a set course', SLOW, async () => {
    await meal('setChoices');
    expect(screen.getByText('Short rib')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: MW.letKitchen }));
    next();
    expect(screen.getByRole('status').textContent).toBe('Main is recorded as chef’s choice.');
  });

  it(
    'shows the answered dish card’s allergens, and a course of drafts is no screen',
    SLOW,
    async () => {
      await meal('cardShito');
      expect(screen.getByText('Contains: crustaceans, fish')).toBeTruthy();
      expect(screen.getByText('Shito · crustaceans, fish')).toBeTruthy();

      await meal('courseOfDrafts');
      expect(screen.getByText(`${PERSON} · Main · 2 of 2`)).toBeTruthy();
    },
  );
});

describe('when picks close, on the meal step (sc-3905)', () => {
  const row = (course: string): HTMLElement =>
    screen.getByText(course, { selector: '.mx-course' }).closest('li') as HTMLElement;
  const send = () => fireEvent.click(screen.getByRole('button', { name: MSW.send }));

  it('changes a pick, holds it as not sent, then saves it', SLOW, async () => {
    await meal('picksOpen', MSW.send);
    send();
    expect(screen.getByRole('status').textContent).toBe(MSW.nothingToSend);
    fireEvent.click(screen.getByRole('button', { name: `Change main for ${PERSON}` }));
    fireEvent.click(screen.getByRole('radio', { name: /Grilled croaker/ }));
    next();
    expect(within(row('Main')).getByText(MSW.notSent)).toBeTruthy();
    send();
    expect(screen.getByRole('status').textContent).toBe(MSW.saved);
    expect(within(row('Main')).queryByText(MSW.notSent)).toBeNull();
  });

  it(
    'greys a closed course with no Change, and asks the hosts once all have closed',
    SLOW,
    async () => {
      await meal('oneClosed', MSW.send);
      expect(within(row('Starter')).getByText('Picks closed on Friday, Oct 16.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: `Change starter for ${PERSON}` })).toBeNull();

      await meal('allClosed', MSW.title);
      expect(screen.queryByRole('button', { name: MSW.send })).toBeNull();
      expect(screen.getByText(MSW.askHosts)).toBeTruthy();
    },
  );

  it(
    'keeps the picks read-only under the paused card, with each close line and no send (#82655)',
    SLOW,
    async () => {
      await meal('paused', MSW.title);
      expect(screen.getByText(/^This event is paused\./u)).toBeTruthy();
      expect(
        screen.getByText(
          'Answers are closed while the event is paused. Anything you sent is kept.',
        ),
      ).toBeTruthy();
      expect(within(row('Starter')).getByText('Picks closed on Friday, Oct 16.')).toBeTruthy();
      expect(within(row('Main')).getByText(/^Picks close /u)).toBeTruthy();
      expect(within(row('Main')).getByText('Jollof rice')).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: /^Change (starter|main|dessert) for / }),
      ).toBeNull();
      expect(screen.queryByRole('button', { name: MSW.send })).toBeNull();
      expect(screen.queryByText(MSW.askHosts)).toBeNull();
    },
  );

  it('refuses the closed course and saves the open one in the same send', SLOW, async () => {
    await meal('refused', MSW.send);
    send();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(
      'Picks for Starter closed on Friday, Oct 16, so your change was not saved.',
    );
    expect(document.activeElement).toBe(alert);
    expect(within(row('Starter')).getByText('Canapé selection')).toBeTruthy();
    expect(within(row('Main')).getByText('Grilled croaker')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(MSW.otherSaved);

    await meal('refusedClosedToo', MSW.send);
    send();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(within(row('Main')).getByText('Jollof rice')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.queryByRole('button', { name: MSW.send })).toBeNull();
  });

  it('shows a closed course’s screen as its pick, and goes on to the next', SLOW, async () => {
    await meal('courseClosed', MW.next);
    expect(heading()).toBe('[Your starter]');
    expect(screen.queryByRole('radio')).toBeNull();
    next();
    expect(heading()).toBe('Main');
  });
});

describe('a course’s default on the meal step (sc-1362)', () => {
  const row = (course: string): HTMLElement =>
    screen.getByText(course, { selector: '.mx-course' }).closest('li') as HTMLElement;
  const waiting =
    'Choose your starter by Friday, Oct 16. If you have not chosen by then, Canapé selection will be waiting for you.';

  it('says the default will be waiting until the person answers', SLOW, async () => {
    await meal('chooseByBefore', MW.next);
    expect(document.getElementById('ms-close')?.textContent).toBe(waiting);
    fireEvent.click(screen.getByRole('radio', { name: /Pepper soup/ }));
    expect(document.getElementById('ms-close')?.textContent).toBe('Picks close Friday, Oct 16.');

    await meal('chooseByBack', MSW.send);
    expect(within(row('Starter')).getByText(waiting)).toBeTruthy();
    expect(within(row('Main')).getByText('Picks close Monday, Oct 19.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Change starter for ${PERSON}` }));
    fireEvent.click(screen.getByRole('radio', { name: /Pepper soup/ }));
    next();
    expect(within(row('Starter')).getByText('Picks close Friday, Oct 16.')).toBeTruthy();
  });

  it('names a companion in the line', SLOW, async () => {
    await meal('chooseByCompanion', MSW.send);
    expect(
      within(row('Starter')).getByText(
        'Choose a starter for Kofi by Friday, Oct 16. If none is chosen by then, Canapé selection will be waiting for Kofi.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change starter for Kofi' })).toBeTruthy();
  });

  it('never mentions the default to someone it leaves out', SLOW, async () => {
    await meal('excludedBefore', MSW.send);
    expect(within(row('Starter')).getByText('Picks close Friday, Oct 16.')).toBeTruthy();
    expect(within(row('Starter')).queryByText(/Canapé selection/)).toBeNull();

    await meal('excludedAfter', MSW.send);
    const inTouch = within(row('Starter')).getByText(
      '[You hadn’t chosen a starter by then. The host will be in touch about it.]',
    );
    expect(inTouch.closest('.mx-pick')?.querySelector('.pc-ring.is-host')).toBeTruthy();
    const closed = within(row('Starter')).getByText('Picks closed on Friday, Oct 16.');
    expect(inTouch.compareDocumentPosition(closed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(row('Starter')).queryByText(MSW.notChosen)).toBeNull();
    expect(screen.queryByRole('button', { name: `Change starter for ${PERSON}` })).toBeNull();
  });

  it('shows the default given to someone who never answered', SLOW, async () => {
    await meal('defaulted', MSW.send);
    expect(within(row('Starter')).getByText('Canapé selection')).toBeTruthy();
    expect(
      within(row('Starter')).getByText('You had not chosen by then, so this is your starter.'),
    ).toBeTruthy();

    await meal('refusedNoPick', MSW.send);
    fireEvent.click(screen.getByRole('button', { name: MSW.send }));
    expect(within(row('Starter')).getByText('Canapé selection')).toBeTruthy();
    expect(
      within(row('Starter')).getByText('You had not chosen by then, so this is your starter.'),
    ).toBeTruthy();

    await meal('refusedExcluded', MSW.send);
    fireEvent.click(screen.getByRole('button', { name: MSW.send }));
    const inTouch = within(row('Starter')).getByText(
      '[You hadn’t chosen a starter by then. The host will be in touch about it.]',
    );
    expect(inTouch.closest('.mx-pick')?.querySelector('.pc-ring.is-host')).toBeTruthy();
    const closed = within(row('Starter')).getByText('Picks closed on Friday, Oct 16.');
    expect(inTouch.compareDocumentPosition(closed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(row('Starter')).queryByText('Canapé selection')).toBeNull();
  });
});
