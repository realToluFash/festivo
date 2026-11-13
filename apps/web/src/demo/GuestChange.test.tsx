import { render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import {
  CALLED_OFF_NOTE,
  CHANGE_NOTE,
  CHANGE_NOTE_LONG,
  GUEST_CHANGE_PAGES,
} from './guestChange.ts';

const SLOW = { timeout: 15000 };
const tested = config();
const FROM = 'A note from Adaeze Obi and Tunde Bakare';
const START = 'The start time is now 18:00 (was 18:30).';
const VENUE = 'The venue is now The Landmark (was Rosewood London).';

async function guest(state: string) {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/demo/guest?state=${state}`] })}
    />,
  );
  await screen.findByRole('banner', {}, SLOW);
}

function entries(): string[] {
  return [...document.querySelectorAll('.gp-messages > .gp-message')].map((one) => one.id);
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  __setConfig(tested);
});

describe('a change’s note in the guest page’s Messages (sc-4330, Decided 13 Nov)', () => {
  it('is linked from the demo home, every state once', () => {
    expect(GUEST_CHANGE_PAGES[0]?.states.map((one) => one.to)).toEqual([
      '/demo/guest?state=changeNote',
      '/demo/guest?state=changeNoteOnly',
      '/demo/guest?state=changeNoteMerged',
      '/demo/guest?state=changeNoteLong',
      '/demo/guest?state=changeNoteFrench',
      '/demo/guest?state=changeNoteCalledOff',
      '/demo/guest?state=changeNoNote',
    ]);
  });

  it(
    'is one entry placed by time among the hosts’ messages: the lines, the note, then when',
    SLOW,
    async () => {
      await guest('changeNote');

      expect(entries()).toEqual(['m-1', 'change', 'm-2', 'm-3']);
      const entry = screen.getByRole('article', { name: FROM });
      const parts = [...entry.children].map((one) => one.textContent);

      expect(parts).toEqual([START, FROM, CHANGE_NOTE, 'Sun, Nov 1 · 16:20']);
    },
  );

  it('opens Messages on a page that had none, with the box to write back', SLOW, async () => {
    await guest('changeNoteOnly');

    expect(entries()).toEqual(['change']);
    expect(screen.getByLabelText('Write to Adaeze Obi and Tunde Bakare')).toBeDefined();
  });

  it('puts the banner’s merged changes in one entry, a line each', SLOW, async () => {
    await guest('changeNoteMerged');
    const entry = screen.getByRole('article', { name: FROM });

    expect(within(entry).getByText(START)).toBeDefined();
    expect(within(entry).getByText(VENUE)).toBeDefined();
    expect(entries().filter((id) => id === 'change')).toHaveLength(1);
  });

  it('keeps a long note’s paragraphs as written', SLOW, async () => {
    await guest('changeNoteLong');

    expect(
      screen.getByText((_, node) => node?.textContent === CHANGE_NOTE_LONG, { selector: 'p' }),
    ).toBeDefined();
  });

  it(
    'gives Soirely’s lines in the page’s language and the note as the host wrote it',
    SLOW,
    async () => {
      await guest('changeNoteFrench');

      expect(screen.getByText('Nouvelle heure de début : 18:00 (avant : 18:30).')).toBeDefined();
      expect(screen.getByText(CHANGE_NOTE)).toBeDefined();
    },
  );

  it('says a call-off in Soirely’s words above the hosts’ note', SLOW, async () => {
    await guest('changeNoteCalledOff');
    const entry = screen.getByRole('article', { name: FROM });

    expect(
      within(entry).getByText('Adaeze & Tunde’s wedding has been called off. It won’t go ahead.'),
    ).toBeDefined();
    expect(within(entry).getByText(CALLED_OFF_NOTE)).toBeDefined();
  });

  it('puts nothing on the page for a change sent with no note', SLOW, async () => {
    await guest('changeNoNote');

    expect(entries()).toEqual(['m-1', 'm-2', 'm-3']);
    expect(screen.queryByText(FROM)).toBeNull();
  });
});
