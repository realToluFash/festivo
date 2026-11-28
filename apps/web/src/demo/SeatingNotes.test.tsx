import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/seating';
const APART = 'Apart: Lina Haddad and Imran Khan are both at Table 6.';

async function seating(state: string) {
  cleanup();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`${AT}?state=${state}`] })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: 'Seating' }, WAIT);
}

function panel(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Panel' });
}

function lists(): HTMLElement {
  return within(panel()).getByRole('group', { name: 'Without a seat or notes' });
}

function room(): HTMLElement {
  return screen.getByRole('group', { name: /^Floor plan, Main hall/u });
}

function table6(): HTMLElement {
  const found = within(room())
    .getAllByRole('button', { name: /^Table 6,/u })
    .filter((one) => (one.getAttribute('aria-label') ?? '').includes('seats taken'));

  expect(found).toHaveLength(1);
  return found[0]!;
}

let fetched: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
  fetched = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  const calls = [...fetched.mock.calls];

  fetched.mockRestore();
  expect(calls).toEqual([]);
});

describe('Notes beside Without a seat (sc-1364)', () => {
  it('counts the broken notes, lists them in words, and shows the table chosen', SLOW, async () => {
    await seating('notesSeat');
    const notes = within(lists()).getByRole('button', { name: /^Notes/u });

    expect(notes.textContent).toBe('Notes2');
    expect(table6().getAttribute('aria-label')).toContain(APART);
    fireEvent.click(notes);
    expect(panel().textContent).toContain('2 broken notes');
    const entry = within(panel()).getByRole('button', { name: `${APART} Show Table 6` });

    fireEvent.click(entry);
    expect(entry.getAttribute('aria-pressed')).toBe('true');
    expect(table6().getAttribute('aria-pressed')).toBe('true');
  });

  it('says so in words when nothing is broken, and when there are no notes', SLOW, async () => {
    await seating('notesNone');
    expect(panel().textContent).toContain('No note is broken.');
    expect(panel().textContent).toContain('2 notes in all');
    await seating('notesEmpty');
    expect(panel().textContent).toContain('No notes yet.');
  });

  it('puts the break in full words on the Tables card', SLOW, async () => {
    await seating('notesTables');
    const card = document.querySelector('[data-card="t6"]');

    expect(card?.textContent).toContain(APART);
    expect(document.querySelector('[data-card="t8"]')?.textContent).toContain(
      'Together: Leila Haddad is at Table 8 and Lina Haddad is at Table 6.',
    );
    expect(document.querySelector('[data-card="t7"]')?.textContent).not.toContain('Apart');
  });

  it('mends a note when a colleague’s move arrives, without a reload', SLOW, async () => {
    await seating('notesLive');
    await waitFor(
      () =>
        expect(screen.getByText(/^Priya Shah moved Leila Haddad to Table 6\./u).textContent).toBe(
          'Priya Shah moved Leila Haddad to Table 6. 1 note is no longer broken.',
        ),
      WAIT,
    );
    expect(panel().textContent).toContain('1 broken note');
  });

  it('shows no tag and no Notes without Manage seating', SLOW, async () => {
    await seating('notesReadOnly');
    expect(within(panel()).queryByRole('group', { name: 'Without a seat or notes' })).toBeNull();
    expect(within(panel()).queryByRole('button', { name: /^Notes for/u })).toBeNull();
    expect(table6().getAttribute('aria-label')).not.toContain('Apart');
  });
});

describe('a guest’s notes (sc-1364)', () => {
  it('opens from Without a seat, a chair, a table’s guests and the List', SLOW, async () => {
    await seating('notesSeat');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Notes for Inês Duarte, 1 note' }));
    expect(within(panel()).getByRole('heading', { name: 'Inês Duarte' })).toBeDefined();
    expect(panel().textContent).toContain('Not seated yet');

    await seating('notesChair');
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Notes for Lina Haddad, 2 notes' }),
    );
    expect(panel().textContent).toContain('Broken');

    await seating('notesTableGuests');
    expect(
      within(panel()).getByRole('button', { name: 'Notes for Imran Khan, 1 note' }),
    ).toBeDefined();

    await seating('notesFromList');
    expect(screen.getByRole('button', { name: 'Notes for Zara Khan, 0 notes' })).toBeDefined();
  });

  it('removes a note from either guest', SLOW, async () => {
    await seating('notesGuest');
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Remove the note with Lucía Ortega' }),
    );
    expect(panel().textContent).toContain('Note removed: Together with Lucía Ortega.');
    expect(panel().textContent).toContain('No notes for Inês Duarte yet.');
  });

  it('adds a note by picking the kind, then the guest', SLOW, async () => {
    await seating('notesAdd');
    fireEvent.click(within(panel()).getByRole('button', { name: /^Elena Rossi/u }));
    fireEvent.click(within(panel()).getByRole('button', { name: 'Add note' }));
    expect(panel().textContent).toContain('Note added: Together with Elena Rossi.');
    expect(within(panel()).getByRole('list', { name: 'Notes' }).children).toHaveLength(3);
  });

  it('names what is missing beside the field, and refuses the same note again', SLOW, async () => {
    await seating('notesBlank');
    expect(panel().textContent).toContain('Choose a kind of note.');
    expect(panel().textContent).toContain('Choose a guest.');
    await seating('notesSame');
    expect(panel().textContent).toContain('Lina Haddad already has this note with Imran Khan.');
    expect(within(panel()).getByRole('searchbox').getAttribute('aria-invalid')).toBe('true');
  });

  it(
    'asks before the other kind replaces a note: Replace swaps it, Cancel keeps it',
    SLOW,
    async () => {
      await seating('notesReplace');
      let ask = within(panel()).getByRole('alertdialog', { name: 'Replace the note?' });

      expect(ask.textContent).toContain('“Not at the same table as Imran Khan”');
      fireEvent.click(within(ask).getByRole('button', { name: 'Replace' }));
      expect(panel().textContent).toContain('Note replaced: Together with Imran Khan.');

      await seating('notesReplace');
      ask = within(panel()).getByRole('alertdialog', { name: 'Replace the note?' });
      fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));
      expect(panel().textContent).toContain(
        'The note is unchanged: Not at the same table as Imran Khan.',
      );
    },
  );

  it('says a search matches nobody and adds nothing', SLOW, async () => {
    await seating('notesNoMatch');
    expect(panel().textContent).toContain('No guest matches “Femi Adebayo”.');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Add note' }));
    expect(panel().textContent).toContain('Choose a guest.');
  });
});
