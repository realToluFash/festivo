import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { SEATING_STATES } from './seating.ts';

const tested = config();
const SLOW = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/seating';

function open(path: string) {
  cleanup();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function seating(state?: string) {
  const router = open(state == null ? AT : `${AT}?state=${state}`);
  await screen.findByRole('heading', { level: 1, name: 'Seating' }, SLOW);

  return router;
}

function panel(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Panel' });
}

function room(): HTMLElement {
  return screen.getByRole('group', { name: /^Floor plan, Main hall/u });
}

/** A table, row or seat on the room, not one of its chairs. */
function item(name: RegExp): HTMLElement {
  const found = within(room())
    .getAllByRole('button', { name })
    .filter((one) => (one.getAttribute('aria-label') ?? '').includes('seats taken'));

  expect(found).toHaveLength(1);
  return found[0]!;
}

/** A press and a release in the same place: what a click on the room is. */
function press(target: Element, options: { shiftKey?: boolean } = {}): void {
  fireEvent.pointerDown(target, {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    ...options,
  });
  fireEvent.pointerUp(window, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
}

function key(target: Element, name: string, options: Partial<KeyboardEventInit> = {}): void {
  fireEvent.keyDown(target, { key: name, ...options });
}

function typeIn(label: string, text: string): HTMLInputElement {
  const field = within(panel()).getByLabelText(label, { exact: false }) as HTMLInputElement;

  fireEvent.change(field, { target: { value: text } });
  fireEvent.keyDown(field, { key: 'Enter' });

  return field;
}

function said(): string {
  return screen
    .getAllByRole('status')
    .map((one) => one.textContent ?? '')
    .join(' | ');
}

function tray(): string {
  return within(panel()).getByText('Without a seat').parentElement?.textContent ?? '';
}

beforeAll(() => {
  // jsdom has no PointerEvent: a MouseEvent with a pointer id stands in for it, as a browser's does.
  if (!('PointerEvent' in window)) {
    class StandIn extends MouseEvent {
      pointerId: number;

      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    Object.defineProperty(window, 'PointerEvent', { value: StandIn, configurable: true });
  }
});

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('nothing leaves the demo', () => {
  it(
    'sends nothing to the API while a table changes, a party is seated and a document is made',
    SLOW,
    async () => {
      const fetched = vi.spyOn(globalThis, 'fetch');

      await seating('tapChooses');
      typeIn('Seats', '12');
      expect(await within(panel()).findByDisplayValue('12')).toBeDefined();
      key(item(/^Table 4,/u), 'Escape');
      fireEvent.click(screen.getByRole('tab', { name: 'Seat' }));
      fireEvent.click(within(panel()).getByRole('button', { name: /^Kwame Mensah \+ 1/u }));
      press(item(/^Table 8,/u));
      expect(await screen.findByText('Kwame Mensah and 1 guest are at Table 8.')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Print' }));
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Print' })).getByRole('button', {
          name: 'Table lists, PDF',
        }),
      );
      expect(
        await screen.findByRole(
          'link',
          { name: 'Adaeze & Tunde’s wedding – Table lists.pdf' },
          { timeout: 4000 },
        ),
      ).toBeDefined();

      expect(fetched).not.toHaveBeenCalled();
      fetched.mockRestore();
    },
  );
});

describe('the plan and the room (sc-3998, sc-4007)', () => {
  it('links every state from the demo’s home, under page 31', SLOW, async () => {
    open('/demo');
    const page = (
      await screen.findByRole('heading', { level: 2, name: /^31 · Venue and seating/u }, SLOW)
    ).parentElement as HTMLElement;
    const links = within(page).getAllByRole('link');

    expect(links).toHaveLength(SEATING_STATES.length);
    expect(links[0]?.getAttribute('href')).toBe(AT);
    expect(links.at(-1)?.getAttribute('href')).toBe(`${AT}?state=paperCardTop`);
  });

  it('is the event’s own Seating entry, lit while it is open', SLOW, async () => {
    const router = open('/demo/events/evt-wed-4');
    const side = await screen.findByRole('navigation', { name: 'Adaeze & Tunde’s wedding' }, SLOW);

    fireEvent.click(within(side).getByRole('link', { name: 'Seating' }));
    await screen.findByRole('heading', { level: 1, name: 'Seating' }, SLOW);
    expect(router.state.location.pathname).toBe(AT);
    expect(
      within(screen.getByRole('navigation', { name: 'Adaeze & Tunde’s wedding' })).getByRole(
        'link',
        { current: 'page' },
      ).textContent,
    ).toBe('Seating');
  });

  it(
    'opens on the room fitted at 57%, every item a named button in reading order, nothing chosen',
    SLOW,
    async () => {
      await seating();
      const items = within(room()).getAllByRole('button', { name: /seats taken/u });

      expect(items).toHaveLength(16);
      expect(items[0]?.getAttribute('aria-label')).toBe(
        'Top table, head table, 6 of 6 seats taken',
      );
      expect(items[5]?.getAttribute('aria-label')).toBe(
        'Table 4, round, 8 of 10 seats taken, Stage side',
      );
      expect(screen.getByText('57%')).toBeDefined();
      expect(within(panel()).getByText('Main hall · 24 m × 18 m')).toBeDefined();
      expect(
        within(panel()).getByRole('switch', { name: 'Snap to grid' }).getAttribute('aria-checked'),
      ).toBe('true');
      expect(within(panel()).getByText('Plum · 5 tables · 50 seats')).toBeDefined();
      expect(
        within(panel()).getByText('1 table · 1 row · 2 single seats · 16 seats'),
      ).toBeDefined();
      expect(said()).toContain('Saved');
      expect(screen.getByText('Priya Shah is on this plan')).toBeDefined();
    },
  );

  it(
    'starts a plan from nothing, refusing a blank or out-of-range size beside its field',
    SLOW,
    async () => {
      await seating('noPlan');
      expect(screen.getByText('No seating plan yet')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Print' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Start the plan' }));

      const start = within(panel()).getByRole('button', { name: 'Start the plan' });

      fireEvent.click(start);
      expect(within(panel()).getByText('Enter the room’s width.')).toBeDefined();
      expect(within(panel()).getByText('Enter the room’s length.')).toBeDefined();
      fireEvent.change(within(panel()).getByLabelText('Width'), { target: { value: '24' } });
      fireEvent.change(within(panel()).getByLabelText('Length'), { target: { value: '1.5' } });
      fireEvent.click(start);
      expect(within(panel()).getByText('The room must be between 2 m and 500 m.')).toBeDefined();
      fireEvent.change(within(panel()).getByLabelText('Length'), { target: { value: '18' } });
      fireEvent.click(start);
      expect(
        await screen.findByText('Add your first table, row or seat from the bar below.'),
      ).toBeDefined();
      expect(
        within(panel()).getByText(
          'No sections yet. A section is a name and a colour on part of the room, such as Terrace.',
        ),
      ).toBeDefined();
    },
  );

  it('loads, fails and tries again', SLOW, async () => {
    await seating('failed');
    expect(screen.getByRole('heading', { name: 'Couldn’t load the seating plan.' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('img', { name: 'Loading the seating plan' })).toBeDefined();
    expect(
      await screen.findByRole('group', { name: /^Floor plan, Main hall/u }, { timeout: 4000 }),
    ).toBeDefined();
  });

  it(
    'is read only for Can view: no Add, no Room settings, a table’s facts in words',
    SLOW,
    async () => {
      await seating('readOnly');
      expect(
        within(panel()).getByText('You can see and print this plan, not change it.'),
      ).toBeDefined();
      expect(screen.queryByRole('button', { name: /Add table/u })).toBeNull();
      expect(within(panel()).queryByRole('button', { name: 'Room settings' })).toBeNull();
      press(item(/^Table 4,/u));
      expect(within(panel()).getByText('Diameter')).toBeDefined();
      expect(within(panel()).queryByRole('button', { name: 'Delete table' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Print' })).toBeDefined();
    },
  );

  it('zooms in steps, fits the room again, and shows a chosen chair at 200%', SLOW, async () => {
    await seating('corner');
    expect(screen.getByText('200%')).toBeDefined();
    expect(within(panel()).getByRole('heading', { name: 'Table 4 · Seat 9' })).toBeDefined();
    expect(within(room()).getByRole('button', { name: 'Table 4, Seat 9, Empty' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByText('150%')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Fit the room' }));
    expect(screen.getByText('57%')).toBeDefined();
  });
});

describe('Room settings and sections (sc-3998)', () => {
  it(
    'refuses a smaller room with things outside it, and applies a bigger one on Enter',
    SLOW,
    async () => {
      await seating('shrinkRefused');
      expect(
        within(panel()).getByText('3 items sit outside 20 m × 18 m. Move them first.'),
      ).toBeDefined();
      typeIn('Width', '30');
      expect(await within(panel()).findByDisplayValue('30')).toBeDefined();
      fireEvent.click(within(panel()).getByRole('button', { name: 'Close' }));
      expect(within(panel()).getByText('Main hall · 30 m × 18 m')).toBeDefined();
    },
  );

  it('asks before deleting the plan, naming what goes', SLOW, async () => {
    await seating('deletePlan');
    const ask = screen.getByRole('alertdialog', { name: 'Delete the plan?' });

    expect(ask.textContent).toContain(
      '13 tables, 1 row and 2 single seats go. Everyone seated goes back to Without a seat; the guest list is not touched.',
    );
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete the plan' }));
    expect(await screen.findByText('No seating plan yet')).toBeDefined();
  });

  it('sizes everything in feet and inches for an organisation in the US', SLOW, async () => {
    await seating('usCustomary');
    expect(within(panel()).getByText('Table 4 would sit outside the room.')).toBeDefined();
    expect(within(panel()).getByText('Type 12′ 4″, 12 ft 4 in, 12.5 ft or 148 in.')).toBeDefined();
    expect(within(panel()).getByLabelText('Diameter')).toHaveProperty('value', '5 ft 11 in');
    expect(screen.getByText('Main hall · 78 ft 9 in × 59 ft 1 in')).toBeDefined();
    typeIn('Across', '52 ft 2 in');
    expect(await within(panel()).findByDisplayValue('52 ft 2 in')).toBeDefined();
  });

  it('starts a US plan in feet, refusing a room out of range in feet', SLOW, async () => {
    await seating('usCustomary');
    press(item(/^Table 4,/u));
    key(item(/^Table 4,/u), 'Escape');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Room settings' }));
    typeIn('Width', '5');
    expect(await within(panel()).findByText('Use 7 to 1,640 ft.')).toBeDefined();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete the plan' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete the plan' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Start the plan' }));
    expect(
      within(panel()).getByText('At The Landmark, London. In feet. Change it in Room settings.'),
    ).toBeDefined();
  });

  it('says a colleague’s change came first', SLOW, async () => {
    await seating('roomChanged');
    expect(
      within(panel()).getByText('Priya Shah just changed this. Your change wasn’t saved.'),
    ).toBeDefined();
  });

  it('adds a section on the least-used colour, refusing a blank or used name', SLOW, async () => {
    await seating('sectionAdd');
    expect(within(panel()).getByRole('radio', { name: 'Blue' })).toHaveProperty('checked', true);
    const name = within(panel()).getByLabelText('Name');

    fireEvent.change(name, { target: { value: 'Stage side' } });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Add section' }));
    expect(
      await within(panel()).findByText('This plan already has a section called Stage side.'),
    ).toBeDefined();
    fireEvent.change(within(panel()).getByLabelText('Name'), { target: { value: '' } });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Add section' }));
    expect(await within(panel()).findByText('Enter a name for the section.')).toBeDefined();
    fireEvent.change(within(panel()).getByLabelText('Name'), { target: { value: 'T'.repeat(41) } });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Add section' }));
    expect(await within(panel()).findByText('Use 40 characters or fewer.')).toBeDefined();
    fireEvent.change(within(panel()).getByLabelText('Name'), { target: { value: 'Terrace' } });
    fireEvent.click(within(panel()).getByRole('radio', { name: 'Rose' }));
    fireEvent.click(within(panel()).getByRole('button', { name: 'Add section' }));
    expect(await within(panel()).findByText('Terrace')).toBeDefined();
    expect(within(panel()).getByText('Rose · 0 tables')).toBeDefined();
  });

  it('refuses a 31st section in the panel', SLOW, async () => {
    await seating('sectionLimit');
    expect(
      within(panel()).getByText('A plan can have up to 30 sections. Delete one to add another.'),
    ).toBeDefined();
    expect(within(panel()).getByRole('heading', { name: 'Sections · 30' })).toBeDefined();
  });

  it('edits a section in place and deletes it after asking, its tables staying', SLOW, async () => {
    await seating('sectionDelete');
    const ask = screen.getByRole('alertdialog', { name: 'Delete Stage side?' });

    expect(ask.textContent).toContain('Its 5 tables stay where they are, with no section.');
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete section' }));
    expect(
      await screen.findByRole('button', { name: 'Table 4, round, 8 of 10 seats taken' }),
    ).toBeDefined();
  });
});

describe('tables, rows and seats (sc-4000, sc-4003)', () => {
  it('adds a table from the menu’s whole phrases and places it at the centre', SLOW, async () => {
    await seating('addMenu');
    const menu = screen.getByRole('menu', { name: 'Add table' });

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((one) => one.textContent),
    ).toEqual([
      'Round table · 180 cm · 10 seats',
      'Rectangular table · 180 × 76 cm · 6 seats',
      'Head table · 240 × 76 cm · 4 seats',
      'Cocktail table · 60 cm · 4 places',
    ]);
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Round table/u }));
    expect(
      screen.getByText('Click the floor to place a round table. It snaps to the grid. Esc stops.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Place at the centre' }));
    expect(
      await within(panel()).findByText('Table 11 added in the nearest free space.'),
    ).toBeDefined();
    expect(within(panel()).getByLabelText('Name')).toHaveProperty('value', 'Table 11');
    fireEvent.click(screen.getByRole('button', { name: 'Stop placing' }));
    expect(screen.queryByText(/Click the floor/u)).toBeNull();
  });

  it(
    'shows each shape’s fields: ends in words on a long table, places on a cocktail table',
    SLOW,
    async () => {
      await seating('rect');
      expect(
        within(panel()).getByText('1 on the left end, 1 on the right, 3 and 3 down the sides.'),
      ).toBeDefined();
      expect(within(panel()).getByLabelText('Rotation')).toBeDefined();
      press(item(/^Bar 1,/u));
      expect(within(panel()).getByLabelText('Places')).toBeDefined();
      expect(within(panel()).queryByLabelText('Rotation')).toBeNull();
    },
  );

  it(
    'refuses a used name and fewer seats than guests beside the field, nothing saved',
    SLOW,
    async () => {
      await seating('tapChooses');
      typeIn('Seats', '6');
      expect(
        await within(panel()).findByText(
          '8 guests are seated here. Move them first, or keep 8 seats.',
        ),
      ).toBeDefined();
      typeIn('Name', 'Table 2');
      expect(
        await within(panel()).findByText('This plan already has a table called Table 2.'),
      ).toBeDefined();
      expect(item(/^Table 4,/u)).toBeDefined();
    },
  );

  it('resets the size on a shape change, and warns when the seats are tight', SLOW, async () => {
    await seating('tapChooses');
    fireEvent.change(within(panel()).getByLabelText('Shape'), { target: { value: 'rect' } });
    expect(
      await within(panel()).findByText(
        'Size reset to the rectangular default, 180 × 76 cm. Seats kept at 10.',
      ),
    ).toBeDefined();
    expect(
      within(panel()).getByText('10 seats will be tight at a 180 × 76 cm table.'),
    ).toBeDefined();
  });

  it('marks a chair unusable and back, and refuses a taken one', SLOW, async () => {
    await seating('chair');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Mark unusable' }));
    expect(await within(panel()).findByRole('button', { name: 'Mark usable' })).toBeDefined();
    expect(within(room()).getByRole('button', { name: 'Table 4, Seat 9, Unusable' })).toBeDefined();
    fireEvent.click(within(room()).getByRole('button', { name: 'Table 4, Seat 2, Chidi Obi' }));
    fireEvent.click(within(panel()).getByRole('button', { name: 'Mark unusable' }));
    expect(
      await within(panel()).findByText('Chidi Obi is in this seat. Move them first.'),
    ).toBeDefined();
  });

  it('duplicates with nobody seated, and deletes after asking who is seated', SLOW, async () => {
    await seating('tapChooses');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Duplicate' }));
    expect(
      await within(panel()).findByText('Table 11 added, a copy of Table 4 with nobody seated.'),
    ).toBeDefined();
    press(item(/^Table 4,/u));
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete table' }));
    const ask = screen.getByRole('alertdialog', { name: 'Delete Table 4?' });

    expect(ask.textContent).toContain('8 guests are seated here. They go back to Without a seat.');
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete Table 4' }));
    await vi.waitFor(() =>
      expect(within(room()).queryByRole('button', { name: /^Table 4,/u })).toBeNull(),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Seat' }));
    expect(within(panel()).getByText('20')).toBeDefined();
  });

  it('says Nobody is seated here before deleting an empty table', SLOW, async () => {
    await seating('deleteEmpty');
    expect(screen.getByRole('alertdialog', { name: 'Delete Table 10?' }).textContent).toContain(
      'Nobody is seated here.',
    );
  });

  it('adds a row and a single seat in the nearest free space', SLOW, async () => {
    await seating();
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    expect(
      await within(panel()).findByText('Row B added in the nearest free space, with 10 seats.'),
    ).toBeDefined();
    expect(within(panel()).getByText('Faces the front · seat 1 on the left')).toBeDefined();
    typeIn('Label', 'A');
    expect(
      await within(panel()).findByText('This plan already has a row labelled A.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add seat' }));
    expect(
      await within(panel()).findByText('Seat 1 added in the nearest free space.'),
    ).toBeDefined();
  });

  it('refuses a row shortened past a guest, and a seat name already used', SLOW, async () => {
    await seating('rowBelowSeated');
    expect(
      within(panel()).getByText('Lars Johansson is in seat 4. Move them first, or keep 4 seats.'),
    ).toBeDefined();
    await seating('seatNameTaken');
    expect(
      within(panel()).getByText('This plan already has a seat called By the door.'),
    ).toBeDefined();
  });

  it('says a colleague changed the table first (412)', SLOW, async () => {
    await seating('tableChanged');
    expect(
      within(panel()).getByText('Priya Shah just changed this table. Your change wasn’t saved.'),
    ).toBeDefined();
    expect(
      item(/^Table 7, round, 8 of 10 seats taken, Garden side, chosen by Priya Shah$/u),
    ).toBeDefined();
  });
});

describe('moving without dragging, and the save line (sc-5028, WCAG 2.2 SC 2.5.7)', () => {
  it(
    'moves with the arrows, a metre with Shift, turns with R and duplicates with ⌘ D',
    SLOW,
    async () => {
      await seating();
      const t4 = item(/^Table 4,/u);

      t4.focus();
      key(t4, 'Enter');
      expect(within(panel()).getByRole('heading', { name: 'Table 4' })).toBeDefined();
      key(t4, 'ArrowRight');
      expect(within(panel()).getByLabelText('Across')).toHaveProperty('value', '16 m');
      key(t4, 'ArrowDown', { shiftKey: true });
      expect(within(panel()).getByLabelText('Down')).toHaveProperty('value', '7.20 m');
      expect(await screen.findByText('Table 4, 16 m across, 7.20 m down. Saved.')).toBeDefined();
      key(t4, 'd', { metaKey: true });
      expect(
        await within(panel()).findByText('Table 11 added, a copy of Table 4 with nobody seated.'),
      ).toBeDefined();
      const t9 = item(/^Table 9,/u);

      t9.focus();
      key(t9, ' ');
      key(t9, 'r');
      expect(within(panel()).getByLabelText('Rotation')).toHaveProperty('value', '15');
      key(t9, 'Delete');
      expect(screen.getByRole('alertdialog', { name: 'Delete Table 9?' })).toBeDefined();
    },
  );

  it('lets go with Esc, and chooses several with Shift', SLOW, async () => {
    await seating();
    press(item(/^Table 6,/u));
    press(item(/^Table 7,/u), { shiftKey: true });
    press(item(/^Table 8,/u), { shiftKey: true });
    expect(within(panel()).getByRole('heading', { name: '3 chosen' })).toBeDefined();
    expect(
      within(panel()).getByText(
        'Shift and click adds or takes one away. Esc lets go of all of them.',
      ),
    ).toBeDefined();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete these' }));
    const ask = screen.getByRole('alertdialog', { name: 'Delete Table 6, Table 7 and Table 8?' });

    expect(ask.textContent).toContain('Their guests go back to Without a seat.');
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep it' }));
    key(item(/^Table 8,/u), 'Escape');
    expect(within(panel()).getByRole('heading', { name: 'Room' })).toBeDefined();
  });

  it('refuses Across past the wall, and moves on a value inside it', SLOW, async () => {
    await seating('acrossRefused');
    expect(within(panel()).getByText('Table 5 would sit outside the room.')).toBeDefined();
    typeIn('Across', '19');
    expect(await within(panel()).findByDisplayValue('19 m')).toBeDefined();
  });

  it('drags a table, the tip saying where, and saves on release', SLOW, async () => {
    await seating();
    const t10 = item(/^Table 10,/u);

    fireEvent.pointerDown(t10, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 100, clientY: 160 });
    expect(screen.getByText(/^19\.80 m across · 1\d\.\d0 m down$/u)).toBeDefined();
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 100, clientY: 160 });
    expect(within(panel()).getByLabelText('Down')).toHaveProperty('value', '12.30 m');
    expect(said()).toContain('Saving…');
  });

  it('says the overlap in Arrange', SLOW, async () => {
    await seating('overlap');
    expect(within(panel()).getByText('Overlaps Table 8')).toBeDefined();
  });

  it('says each save line state, and tries again', SLOW, async () => {
    await seating('retrying');
    expect(said()).toContain('Couldn’t save. Trying again…');
    expect(screen.getByText('Can’t see who else is here. Reconnecting…')).toBeDefined();
    await seating('notSaved');
    fireEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]!);
    expect(said()).toContain('Saving…');
  });

  it('refuses a step of three whole when a colleague moved one first', SLOW, async () => {
    await seating('stepRefused');
    expect(
      screen.getByText('Priya Shah just moved Table 7. Your change wasn’t saved.'),
    ).toBeDefined();
    expect(within(panel()).getByRole('heading', { name: '3 chosen' })).toBeDefined();
  });

  it(
    'starts the keyboard on Table 4 in Tab order, and shows the keys while it is chosen',
    SLOW,
    async () => {
      await seating('tabOrder');
      await vi.waitFor(() =>
        expect(document.activeElement?.getAttribute('aria-label')).toBe(
          'Table 4, round, 8 of 10 seats taken, Stage side',
        ),
      );
      expect(await screen.findByRole('note', { name: 'Keys for the chosen item' })).toBeDefined();
    },
  );
});

describe('who else is here (sc-4719)', () => {
  it('shows four chips and +2, which opens everyone on the plan', SLOW, async () => {
    await seating('presenceSix');
    expect(screen.getByRole('button', { name: '2 more on this plan' })).toBeDefined();
    const list = screen.getByRole('dialog', { name: 'On this plan' });

    expect(within(list).getAllByText('Can view')).toHaveLength(2);
    expect(item(/chosen by Julien Moreau$/u)).toBeDefined();
  });

  it('never outlines a viewer’s choice, and hides the chips while reconnecting', SLOW, async () => {
    await seating('presenceViewer');
    expect(screen.getByText('Priya Shah and 1 other')).toBeDefined();
    expect(within(room()).queryByRole('button', { name: /chosen by/u })).toBeNull();
    await seating('reconnecting');
    expect(screen.getAllByText('Can’t see who else is here. Reconnecting…').length).toBeGreaterThan(
      0,
    );
  });

  it('says who joined and who left, politely', SLOW, async () => {
    await seating('presenceOne');
    expect(
      await screen.findByText('Priya Shah joined the plan.', undefined, { timeout: 4000 }),
    ).toBeDefined();
    expect(screen.getByText('Priya Shah is on this plan')).toBeDefined();
    await seating('left');
    expect(await screen.findByText('Priya Shah left the plan.')).toBeDefined();
  });

  it('refuses the later change when both chose the same table (412)', SLOW, async () => {
    await seating('presenceBoth');
    expect(within(panel()).getByText(/^Priya Shah has chosen this too\./u)).toBeDefined();
    typeIn('Across', '9');
    expect(
      await screen.findByText('Priya Shah just moved Table 7. Your change wasn’t saved.'),
    ).toBeDefined();
    expect(within(panel()).getByLabelText('Down')).toHaveProperty('value', '11.20 m');
  });

  it('lets a colleague’s saved change arrive without clearing yours', SLOW, async () => {
    await seating('arriving');
    expect(
      await screen.findByRole(
        'button',
        { name: /^Table 9, .*chosen by Priya Shah$/u },
        { timeout: 4000 },
      ),
    ).toBeDefined();
    expect(within(panel()).getByRole('heading', { name: 'Table 4' })).toBeDefined();
  });
});

describe('seating guests (sc-4013, sc-4016, sc-5030)', () => {
  it('picks a party and seats it side by side, with Undo', SLOW, async () => {
    await seating('seat');
    expect(tray()).toContain('12');
    fireEvent.click(within(panel()).getByRole('button', { name: /^Kwame Mensah \+ 1/u }));
    expect(screen.getByText('Now pick a table for Kwame Mensah and 1 guest.')).toBeDefined();
    press(item(/^Table 8,/u));
    expect(await screen.findByText('Kwame Mensah and 1 guest are at Table 8.')).toBeDefined();
    expect(tray()).toContain('10');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(tray()).toContain('12');
  });

  it(
    'refuses a full table, and offers Seat just {name} when the party won’t fit',
    SLOW,
    async () => {
      await seating('full');
      expect(
        screen.getByText('Table 1 is full. Pick another table, or move someone off it first.'),
      ).toBeDefined();
      await seating('short');
      expect(screen.getByText('Table 4 has 2 free seats. Amaka Eze’s party is 3.')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Seat just Amaka Eze' }));
      expect(await screen.findByText('Amaka Eze is at Table 4.')).toBeDefined();
      expect(
        within(panel()).getByRole('button', { name: /^Guest of Amaka Eze(?! \+)/u }),
      ).toBeDefined();
    },
  );

  it('swaps on a taken chair, the one moved going back to Without a seat', SLOW, async () => {
    await seating('swap');
    expect(screen.getByText('Table 4, seat 3 is Funmi Adeyemi’s.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Swap with Funmi Adeyemi' }));
    expect(await screen.findByText('Lucía Ortega is at Table 4.')).toBeDefined();
    expect(within(panel()).getByRole('button', { name: /^Funmi Adeyemi/u })).toBeDefined();
  });

  it('says a race and a refused Undo', SLOW, async () => {
    await seating('race');
    expect(
      screen.getByText('Someone just took that seat. Lucía Ortega is still without a seat.'),
    ).toBeDefined();
    await seating('undoRefused');
    expect(
      screen.getAllByText('These seats changed since. Nothing was undone.').length,
    ).toBeGreaterThan(0);
  });

  it(
    'lists a table’s guests, unseats them, and moves everyone to a table with room',
    SLOW,
    async () => {
      await seating('moveAll');
      expect(screen.getByText('Tables with room for all 8.')).toBeDefined();
      fireEvent.click(
        within(screen.getByRole('dialog', { name: /^Table 4,/u })).getByRole('button', {
          name: /^Table 10/u,
        }),
      );
      expect(await within(panel()).findByText('Table 10')).toBeDefined();
      expect(item(/^Table 10, round, 8 of 10 seats taken/u)).toBeDefined();
      expect(screen.getByText('8 guests moved to Table 10.')).toBeDefined();
      fireEvent.click(within(panel()).getByRole('button', { name: 'Unseat everyone' }));
      expect(item(/^Table 10, round, 0 of 10 seats taken/u)).toBeDefined();
      expect(screen.getByText('Table 10 is empty now.')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(item(/^Table 10, round, 8 of 10 seats taken/u)).toBeDefined();
    },
  );

  it('says an empty table, everyone seated, and a search that matches nobody', SLOW, async () => {
    await seating('emptyTable');
    expect(
      within(panel()).getByText('Nobody here yet. Pick a guest in Seat, then this table.'),
    ).toBeDefined();
    await seating('everyoneSeated');
    expect(
      within(panel()).getAllByText('Everyone who is coming has a seat.').length,
    ).toBeGreaterThan(0);
    await seating('noMatch');
    expect(within(panel()).getByText('Nobody without a seat matches this search.')).toBeDefined();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Clear search and group' }));
    expect(within(panel()).getByRole('button', { name: /^Marta Silva/u })).toBeDefined();
  });

  it(
    'shows Not sure yet and no reply in the guest’s own words when switched on',
    SLOW,
    async () => {
      await seating('notSureYet');
      expect(within(panel()).getByText('31 more with Not sure yet or no reply')).toBeDefined();
      expect(within(panel()).getByText('Work · Not sure yet')).toBeDefined();
      expect(within(panel()).getAllByText('Friends · No reply').length).toBeGreaterThan(0);
      fireEvent.click(within(panel()).getByRole('checkbox', { name: /^Work/u }));
      expect(within(panel()).queryByRole('button', { name: /^Kwame Mensah/u })).toBeNull();
    },
  );
});

describe('the Tables and List views (sc-4013, sc-4016)', () => {
  it('cards the tables by section, filters them, and seats from a card', SLOW, async () => {
    await seating('tablesPicked');
    fireEvent.click(screen.getByRole('button', { name: 'Garden side' }));
    expect(screen.queryByRole('button', { name: /^Table 1, round/u })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Table 8, round/u }));
    expect(await screen.findByText('Kwame Mensah and 1 guest are at Table 8.')).toBeDefined();
  });

  it(
    'opens the List on With space, a table opening to its chairs with Seat here',
    SLOW,
    async () => {
      await seating('listOpen');
      expect(
        screen.getByRole('button', { name: 'With space · 11' }).getAttribute('aria-pressed'),
      ).toBe('true');
      expect(screen.getByRole('table', { name: 'Tables, rows and seats' })).toBeDefined();
      const seat10 = screen
        .getAllByRole('row')
        .find((row) => row.textContent?.startsWith('Seat 10'));

      expect(screen.getAllByRole('button', { name: 'Seat here' }).length).toBeGreaterThan(3);
      fireEvent.click(within(seat10!).getByRole('button', { name: 'Seat here' }));
      expect(await screen.findByText(/^Kwame Mensah and 1 guest are at Table 8/u)).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Full · 5' }));
      expect(screen.getByRole('button', { name: /^Table 1/u, expanded: false })).toBeDefined();
    },
  );
});

describe('Print and its paper (sc-4024, sc-5032)', () => {
  it('prepares a document, then names the file it downloaded', SLOW, async () => {
    await seating('print');
    const print = screen.getByRole('dialog', { name: 'Print' });

    expect(within(print).getByRole('radio', { name: 'A4' })).toHaveProperty('checked', true);
    expect(within(print).getByText('AC, not yet built · sc-5031')).toBeDefined();
    fireEvent.click(within(print).getByRole('button', { name: 'Table lists, PDF' }));
    expect(within(print).getByText('Preparing Table lists…')).toBeDefined();
    const file = await within(print).findByRole(
      'link',
      { name: 'Adaeze & Tunde’s wedding – Table lists.pdf' },
      { timeout: 4000 },
    );

    expect(file.getAttribute('href')).toBe(`${AT}?state=paperLists`);
  });

  it('says a document couldn’t be made, and that read only can print', SLOW, async () => {
    await seating('printFailed');
    expect(
      screen.getByText('Table cards couldn’t be made. Nothing on the plan changed.'),
    ).toBeDefined();
    await seating('printReadOnly');
    expect(
      within(screen.getByRole('dialog', { name: 'Print' })).getByText(
        'You can see and print this plan, not change it.',
      ),
    ).toBeDefined();
  });

  it(
    'prints the floor plan, the table lists and a table card in black and white',
    SLOW,
    async () => {
      open(`${AT}?state=paperFloor`);
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Floor plan' }, SLOW),
      ).toBeDefined();
      expect(
        screen.getByText('Seats proposed by Auto-seat and not yet accepted print as Empty.'),
      ).toBeDefined();
      expect(screen.getByText('Adaeze & Tunde’s wedding – Floor plan.pdf')).toBeDefined();
      expect(screen.getByText('As of Tuesday, Nov 3, 16:05')).toBeDefined();
    },
  );

  it('lists every chair by number, and says when nobody is seated', SLOW, async () => {
    open(`${AT}?state=paperLists`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Table lists' }, SLOW),
    ).toBeDefined();
    expect(screen.getByText('Page 1 of 3')).toBeDefined();
    expect(screen.getAllByText('Empty').length).toBeGreaterThan(4);
  });

  it('folds a table card with its name on both halves', SLOW, async () => {
    open(`${AT}?state=paperCardTop`);
    expect(await screen.findAllByText('Top table', undefined, SLOW)).toHaveLength(2);
    expect(screen.getByText('Page 13 of 13')).toBeDefined();
  });
});
