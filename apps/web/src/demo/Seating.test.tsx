import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { SEATING_STATES } from './seating.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/seating';

function open(path: string) {
  cleanup();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function seating(state?: string) {
  const router = open(state == null ? AT : `${AT}?state=${state}`);
  await screen.findByRole('heading', { level: 1, name: 'Seating' }, WAIT);

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

/** A press on the room that takes the focus out of a field first, as a browser's does. */
function tapAway(target: Element): void {
  fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
  (document.activeElement as HTMLElement | null)?.blur();
  fireEvent.pointerUp(window, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
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
  let fetched: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetched = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    const calls = [...fetched.mock.calls];
    fetched.mockRestore();

    expect(calls).toEqual([]);
  });

  it('sends nothing to the API while a table changes', SLOW, async () => {
    await seating('tapChooses');
    typeIn('Seats', '12');

    expect(await within(panel()).findByDisplayValue('12')).toBeDefined();
  });

  it('sends nothing to the API while a party is seated', SLOW, async () => {
    await seating('tapChooses');
    key(item(/^Table 4,/u), 'Escape');
    fireEvent.click(screen.getByRole('tab', { name: 'Seat' }));
    fireEvent.click(within(panel()).getByRole('button', { name: /^Kwame Mensah \+ 1/u }));
    press(item(/^Table 8,/u));

    expect(await screen.findByText('Kwame Mensah and 1 guest are at Table 8.')).toBeDefined();
  });

  it('sends nothing to the API while a document is made', SLOW, async () => {
    await seating('tapChooses');
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Print' })).getByRole('button', {
        name: 'Table lists, PDF',
      }),
    );

    expect(
      await screen.findByRole('link', { name: 'Adaeze & Tunde’s wedding – Table lists.pdf' }, WAIT),
    ).toBeDefined();
  });
});

describe('the plan and the room (sc-3998, sc-4007)', () => {
  it('links every state from the demo’s home, under page 31', SLOW, async () => {
    open('/demo');
    const page = (
      await screen.findByRole('heading', { level: 2, name: /^31 · Venue and seating/u }, WAIT)
    ).parentElement as HTMLElement;
    const links = within(page).getAllByRole('link');

    expect(links).toHaveLength(SEATING_STATES.length);
    expect(links[0]?.getAttribute('href')).toBe(AT);
    expect(links.at(-1)?.getAttribute('href')).toBe(`${AT}?state=crumbFocus`);
  });

  it('is the event’s own Seating entry, lit while it is open', SLOW, async () => {
    const router = open('/demo/events/evt-wed-4');
    const side = await screen.findByRole('navigation', { name: 'Adaeze & Tunde’s wedding' }, WAIT);

    fireEvent.click(within(side).getByRole('link', { name: 'Seating' }));
    await screen.findByRole('heading', { level: 1, name: 'Seating' }, WAIT);
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

      expect(
        within(panel()).getByText(
          'At The Landmark, London. Sizes are in metres, the units used where Ire Events is based.',
        ),
      ).toBeDefined();
      fireEvent.click(start);
      expect(within(panel()).getByText('Enter the room’s width.')).toBeDefined();
      expect(within(panel()).getByText('Enter the room’s length.')).toBeDefined();
      fireEvent.change(within(panel()).getByLabelText('Width'), { target: { value: '24' } });
      fireEvent.change(within(panel()).getByLabelText('Length'), { target: { value: '1.5' } });
      fireEvent.click(start);
      expect(within(panel()).getByText('The room must be between 2 m and 500 m.')).toBeDefined();
      fireEvent.change(within(panel()).getByLabelText('Length'), { target: { value: '18' } });
      fireEvent.click(start);
      const hint = await screen.findByText('Add your first table, row or seat from the bar below.');
      expect(hint.closest('.st-bar')?.classList.contains('is-floor')).toBe(true);
      expect(
        within(panel()).getByText(
          'No sections yet. A section is a name and a colour on part of the room, such as Terrace.',
        ),
      ).toBeDefined();
    },
  );

  it('loads, fails and tries again', SLOW, async () => {
    await seating('failed');
    expect(screen.getByRole('heading', { name: 'Could not load the seating plan.' })).toBeDefined();
    expect(
      screen.getByText('Check your connection and try again. Nothing on the plan has changed.'),
    ).toBeDefined();
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
        within(panel()).getByText('You can view and print this plan, but not change it.'),
      ).toBeDefined();
      expect(screen.queryByRole('button', { name: /Add table/u })).toBeNull();
      expect(within(panel()).queryByRole('button', { name: 'Room settings' })).toBeNull();
      press(item(/^Table 4,/u));
      expect(within(panel()).getByText('Diameter')).toBeDefined();
      expect(within(panel()).queryByRole('button', { name: 'Delete table' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Print' })).toBeDefined();
    },
  );

  it(
    'reads a rectangular or head table’s length, ends and rotation for Can view (sc-56437)',
    SLOW,
    async () => {
      await seating('readOnlyTable');
      const facts = (): [string, string][] =>
        Array.from(panel().querySelectorAll('dl.st-facts > div')).map((row) => [
          row.querySelector('dt')?.textContent ?? '',
          row.querySelector('dd')?.textContent ?? '',
        ]);

      expect(facts()).toEqual([
        ['Section', 'Garden side'],
        ['Shape', 'Rectangular table'],
        ['Seats', '8'],
        ['Width', '240 cm'],
        ['Length', '76 cm'],
        ['Seats on the ends', '2'],
        ['Rotation', '15°'],
        ['Across', expect.any(String)],
        ['Down', expect.any(String)],
      ]);
      press(item(/^Top table,/u));
      expect(facts().slice(0, 7)).toEqual([
        ['Section', 'No section'],
        ['Shape', expect.any(String)],
        ['Seats', '6'],
        ['Width', '360 cm'],
        ['Length', '76 cm'],
        ['Seats on the ends', '0'],
        ['Rotation', '0°'],
      ]);
      press(item(/^Table 4,/u));
      expect(facts().map(([key]) => key)).toEqual([
        'Section',
        'Shape',
        'Seats',
        'Diameter',
        'Across',
        'Down',
      ]);
      press(item(/^Bar 1,/u));
      expect(facts().map(([key]) => key)).toEqual([
        'Section',
        'Shape',
        'Places',
        'Diameter',
        'Across',
        'Down',
      ]);
    },
  );

  it(
    'reads a default rectangular table in feet and inches for Can view (sc-56437)',
    SLOW,
    async () => {
      await seating('readOnlyTableUs');
      const facts = new Map(
        Array.from(panel().querySelectorAll('dl.st-facts > div')).map((row) => [
          row.querySelector('dt')?.textContent ?? '',
          row.querySelector('dd')?.textContent ?? '',
        ]),
      );

      expect(facts.get('Width')).toBe('5 ft 11 in');
      expect(facts.get('Length')).toBe('2 ft 6 in');
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

  it(
    'holds − at 25% and + at 400% aria-disabled, as the product does (sc-57678)',
    SLOW,
    async () => {
      await seating('corner');
      const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
      const zoomOut = screen.getByRole('button', { name: 'Zoom out' });

      expect(zoomIn.getAttribute('aria-disabled')).toBe('false');
      fireEvent.click(zoomIn);
      fireEvent.click(zoomIn);
      expect(screen.getByText('400%')).toBeDefined();
      expect(zoomIn.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(zoomIn);
      expect(screen.getByText('400%')).toBeDefined();
      for (let step = 0; step < 8; step++) fireEvent.click(zoomOut);
      expect(screen.getByText('25%')).toBeDefined();
      expect(zoomOut.getAttribute('aria-disabled')).toBe('true');
      expect(zoomIn.getAttribute('aria-disabled')).toBe('false');
    },
  );

  describe('the view follows keyboard focus (sc-4007, WCAG 2.2 2.4.11)', () => {
    type Rect = [number, number, number, number];

    function measure(boxes: (node: Element) => Rect | null) {
      return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: Element,
      ) {
        const [left, top, right, bottom] = this.classList.contains('st-canvas')
          ? [0, 0, 718, 719]
          : (boxes(this) ?? [0, 0, 0, 0]);

        return {
          left,
          top,
          right,
          bottom,
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
        } as DOMRect;
      });
    }

    function view(): string {
      const box = document.querySelector('.st-view-box');

      return `${box?.getAttribute('x')} ${box?.getAttribute('y')}`;
    }

    async function table4(boxes: (node: Element, table: Element) => Rect | null) {
      await seating('corner');
      const table = item(/^Table 4,/u);

      return { table, measured: measure((node) => boxes(node, table)) };
    }

    it('slides the plan to an item Tab reaches out of view', SLOW, async () => {
      const { table, measured } = await table4((node, t) =>
        node === t ? [800, 300, 900, 400] : null,
      );

      try {
        const before = view();

        table.focus();
        await waitFor(() => expect(view()).not.toBe(before), WAIT);
      } finally {
        measured.mockRestore();
      }
    });

    it('slides an item out from under the small map', SLOW, async () => {
      const { table, measured } = await table4((node, t) =>
        node === t
          ? [600, 540, 660, 600]
          : node.classList.contains('st-minimap')
            ? [530, 507, 702, 639]
            : null,
      );

      try {
        const before = view();

        table.focus();
        await waitFor(() => expect(view()).not.toBe(before), WAIT);
      } finally {
        measured.mockRestore();
      }
    });

    it(
      'slides an item up until its focus halo, drawn after the focus, clears the small map (sc-57361)',
      SLOW,
      async () => {
        const { table, measured } = await table4((node, t) =>
          node === t
            ? [600, 560, 660, 590]
            : node.classList.contains('st-minimap')
              ? [530, 607, 702, 739]
              : null,
        );
        const top = () => Number(document.querySelector('.st-floor[y]')?.getAttribute('y'));

        try {
          const before = top();

          table.focus();
          // 590 + 20 of ring and halo + 8 clear - 607 of map: 11 px up.
          await waitFor(() => expect(before - top()).toBeCloseTo(11, 1), WAIT);
        } finally {
          measured.mockRestore();
        }
      },
    );

    it('leaves the view where it is when a click puts the focus there', SLOW, async () => {
      const { table, measured } = await table4((node, t) =>
        node === t ? [800, 300, 900, 400] : null,
      );
      const matches = Element.prototype.matches;
      const pointer = vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
        this: Element,
        selector: string,
      ) {
        return selector === ':focus-visible' ? false : matches.call(this, selector);
      });

      try {
        const before = view();

        press(table);
        table.focus();
        await new Promise((done) => window.setTimeout(done, 50));
        expect(view()).toBe(before);
      } finally {
        pointer.mockRestore();
        measured.mockRestore();
      }
    });

    describe('and keeps an item moved by keys clear of the keys strip (sc-61042)', () => {
      const CLEAR: Rect = [300, 200, 360, 260];
      const UNDER: Rect = [300, 540, 360, 600];
      let at: Rect = CLEAR;
      let strip: Rect = [16, 520, 702, 600];

      function floor(): string {
        const box = document.querySelector('.st-floor[y]');

        return `${box?.getAttribute('x')} ${box?.getAttribute('y')}`;
      }

      const top = () => Number(document.querySelector('.st-floor[y]')?.getAttribute('y'));
      const HALF_STROKE = 2.5;

      function clear(before: number, reach = HALF_STROKE): void {
        expect(at[3] + reach + top() - before).toBeCloseTo(strip[1] - 8, 0);
      }

      async function chosen() {
        at = CLEAR;
        strip = [16, 520, 702, 600];
        await seating();
        const table = item(/^Table 9,/u);
        const measured = measure((node) =>
          node === table ? at : node.classList.contains('st-keys') ? strip : null,
        );

        key(table, 'Tab');
        table.focus();
        key(table, 'Enter');
        await screen.findByRole('note', { name: 'Keys for the chosen item' }, WAIT);
        return { table, measured };
      }

      async function still(before: string): Promise<void> {
        await new Promise((done) => window.setTimeout(done, 50));
        expect(floor()).toBe(before);
      }

      it('pans after an arrow, a Shift+arrow and R', SLOW, async () => {
        const { table, measured } = await chosen();

        try {
          at = UNDER;
          const turned = (15 * Math.PI) / 180;

          for (const [name, shiftKey, reach] of [
            ['ArrowUp', false, HALF_STROKE],
            ['ArrowLeft', true, HALF_STROKE],
            ['r', false, HALF_STROKE * (Math.cos(turned) + Math.sin(turned))],
          ] as const) {
            const before = top();

            key(table, name, { shiftKey });
            await waitFor(() => clear(before, reach), WAIT);
          }
        } finally {
          measured.mockRestore();
        }
      });

      it('pans after an arrow the room stops, with nothing moved', SLOW, async () => {
        const { table, measured } = await chosen();
        const down = () => (within(panel()).getByLabelText('Down') as HTMLInputElement).value;

        try {
          for (let step = 0; step < 40; step += 1) key(table, 'ArrowDown', { shiftKey: true });
          const foot = down();

          at = UNDER;
          const before = top();

          key(table, 'ArrowDown', { shiftKey: true });
          // 600 + 8 clear - 520 of strip is 88 short, and the half stroke makes 90.5 up.
          await waitFor(() => expect(before - top()).toBeCloseTo(90.5, 1), WAIT);
          clear(before);
          expect(down()).toBe(foot);
        } finally {
          measured.mockRestore();
        }
      });

      it('leaves the plan where it is for an item already clear', SLOW, async () => {
        const { table, measured } = await chosen();

        try {
          const before = floor();

          key(table, 'ArrowUp');
          await still(before);
        } finally {
          measured.mockRestore();
        }
      });

      it('pans when the strip shows over the focused item', SLOW, async () => {
        at = UNDER;
        await seating();
        const table = item(/^Table 9,/u);
        const measured = measure((node) =>
          node === table ? at : node.classList.contains('st-keys') ? strip : null,
        );

        try {
          key(table, 'Tab');
          table.focus();
          await new Promise((done) => window.setTimeout(done, 50));
          const before = top();

          key(table, 'Enter');
          await waitFor(() => clear(before), WAIT);
        } finally {
          measured.mockRestore();
        }
      });

      it('pans when the strip wraps to a second line', SLOW, async () => {
        const watching: { tell: ResizeObserverCallback; bars: Element[] }[] = [];

        vi.stubGlobal(
          'ResizeObserver',
          class {
            private readonly seen: { tell: ResizeObserverCallback; bars: Element[] };

            constructor(tell: ResizeObserverCallback) {
              this.seen = { tell, bars: [] };
              watching.push(this.seen);
            }

            observe(bar: Element): void {
              this.seen.bars.push(bar);
            }

            disconnect(): void {
              this.seen.bars = [];
            }
          },
        );
        const grow = () =>
          watching.forEach(({ tell, bars }) =>
            tell(
              bars.map((target) => ({ target }) as ResizeObserverEntry),
              {} as ResizeObserver,
            ),
          );
        const { measured } = await chosen();

        try {
          at = [300, 440, 360, 500];
          grow();
          const before = top();

          strip = [16, 440, 702, 600];
          grow();
          await waitFor(() => clear(before), WAIT);
        } finally {
          measured.mockRestore();
          vi.unstubAllGlobals();
        }
      });

      it('never pans after a click or a drag, even under the strip', SLOW, async () => {
        const { table, measured } = await chosen();
        const matches = Element.prototype.matches;
        const pointer = vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
          this: Element,
          selector: string,
        ) {
          return selector === ':focus-visible' ? false : matches.call(this, selector);
        });

        try {
          at = UNDER;
          const before = floor();

          press(table);
          await still(before);
          fireEvent.pointerDown(table, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
          fireEvent.pointerMove(window, { pointerId: 1, clientX: 100, clientY: 160 });
          fireEvent.pointerUp(window, { button: 0, pointerId: 1, clientX: 100, clientY: 160 });
          await still(before);
        } finally {
          pointer.mockRestore();
          measured.mockRestore();
        }
      });
    });
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
      'This also deletes 3 sections, 13 tables, 1 row and 2 single seats. 85 seated guests move to Without a seat; the guest list does not change.',
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
    expect(within(panel()).getByText('Type 12′ 4″, 12 ft 4 in, 12.5 ft or 148 in.')).toBeDefined();
    typeIn('Width', '5');
    expect(await within(panel()).findByText('Use 7 to 1,640 ft.')).toBeDefined();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete the plan' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete the plan' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Start the plan' }));
    expect(
      within(panel()).getByText(
        'At The Landmark, London. Sizes are in feet and inches, the units used where Ire Events is based.',
      ),
    ).toBeDefined();
    expect(within(panel()).getByText('Type 12′ 4″, 12 ft 4 in, 12.5 ft or 148 in.')).toBeDefined();
    fireEvent.change(within(panel()).getByLabelText('Width'), { target: { value: '80' } });
    fireEvent.change(within(panel()).getByLabelText('Length'), { target: { value: '59′ 1″' } });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Start the plan' }));
    expect(await within(panel()).findByText('Main hall · 80 ft × 59 ft 1 in')).toBeDefined();
  });

  it('says a colleague’s change came first', SLOW, async () => {
    await seating('roomChanged');
    expect(
      within(panel()).getByText('Priya Shah just changed this. Your change was not saved.'),
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

  it(
    'names the rows and single seats a section leaves with no section (sc-54060)',
    SLOW,
    async () => {
      await seating('sectionDeleteRows');
      const ask = screen.getByRole('alertdialog', { name: 'Delete Quiet corner?' });

      expect(ask.textContent).toContain(
        'Its 1 row and 1 single seat stay where they are, with no section.',
      );
      expect(
        within(panel()).getByText(
          'Its tables, rows and single seats stay where they are, with no section.',
        ),
      ).toBeDefined();
      fireEvent.click(within(ask).getByRole('button', { name: 'Delete section' }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
    },
  );

  it('asks only "Delete {name}?" for an empty section (pm, 9 Nov)', SLOW, async () => {
    await seating('sectionDeleteEmpty');
    const ask = screen.getByRole('alertdialog', { name: 'Delete Quiet corner?' });

    expect(ask.textContent).not.toContain('stay where they are');
    expect(ask.querySelector('p')?.textContent).toBe('');
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete section' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
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
    'gives Section and Shape a full row each, so a long name is never clipped (qa5 #54266)',
    SLOW,
    async () => {
      await seating('placed');
      for (const label of ['Section', 'Shape']) {
        expect(within(panel()).getByLabelText(label).closest('.st-two')).toBeNull();
      }
      await seating('rowAdded');
      for (const label of ['Label', 'Section']) {
        expect(within(panel()).getByLabelText(label).closest('.st-two')).toBeNull();
      }
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

  it(
    'keeps a refused size beside its field on the first tap away, and drops it on the second',
    SLOW,
    async () => {
      await seating('tapChooses');
      const diameter = within(panel()).getByLabelText('Diameter');

      diameter.focus();
      fireEvent.change(diameter, { target: { value: 'wide' } });
      tapAway(room());
      expect(await within(panel()).findByText('Enter a size from 40 cm to 10 m.')).toBeDefined();
      expect(within(panel()).getByRole('heading', { name: 'Table 4' })).toBeDefined();
      await vi.waitFor(() => expect(document.activeElement).toBe(diameter));
      fireEvent.change(diameter, { target: { value: '20' } });
      tapAway(item(/^Table 8,/u));
      expect(within(panel()).getByRole('heading', { name: 'Table 8' })).toBeDefined();
      press(item(/^Table 4,/u));
      expect(within(panel()).getByLabelText('Diameter')).toHaveProperty('value', '180');
    },
  );

  it('keeps Table 4 chosen when a refused size is left by a press on Table 8', SLOW, async () => {
    await seating('tapChooses');
    const diameter = within(panel()).getByLabelText('Diameter');

    diameter.focus();
    fireEvent.change(diameter, { target: { value: 'wide' } });
    tapAway(item(/^Table 8,/u));
    expect(await within(panel()).findByText('Enter a size from 40 cm to 10 m.')).toBeDefined();
    expect(within(panel()).getByRole('heading', { name: 'Table 4' })).toBeDefined();
    await vi.waitFor(() => expect(document.activeElement).toBe(diameter));
  });

  it('refuses a size out of range, or one it can’t read, on a plan in feet', SLOW, async () => {
    await seating('usCustomary');
    typeIn('Diameter', '15 in');
    expect(
      await within(panel()).findByText('Enter a size from 1 ft 4 in to 32 ft 9 in.'),
    ).toBeDefined();
    typeIn('Diameter', 'wide');
    expect(
      await within(panel()).findAllByText('Type 12′ 4″, 12 ft 4 in, 12.5 ft or 148 in.'),
    ).toHaveLength(2);
  });

  it(
    'refuses a blank name, seats past 30, a size past 10 m or not a number, and ends past the seats',
    SLOW,
    async () => {
      await seating('tapChooses');
      typeIn('Name', '');
      expect(await within(panel()).findByText('Enter a name for the table.')).toBeDefined();
      typeIn('Seats', '31');
      expect(
        await within(panel()).findByText('Enter a number of seats from 1 to 30.'),
      ).toBeDefined();
      typeIn('Seats', '0');
      expect(
        await within(panel()).findByText('Enter a number of seats from 1 to 30.'),
      ).toBeDefined();
      expect(within(panel()).getByRole('heading', { name: 'Table 4' })).toBeDefined();
      expect(item(/^Table 4, round, 8 of 10 seats taken/u)).toBeDefined();
      await seating('rect');
      typeIn('Width', '1001');
      expect(await within(panel()).findByText('Enter a size from 40 cm to 10 m.')).toBeDefined();
      typeIn('Length', 'long');
      expect(await within(panel()).findAllByText('Enter a size from 40 cm to 10 m.')).toHaveLength(
        2,
      );
      typeIn('Seats on the ends', '9');
      expect(
        await within(panel()).findByText('Enter 0 to 8, no more than the table has seats.'),
      ).toBeDefined();
      expect(within(panel()).getByRole('heading', { name: 'Table 9' })).toBeDefined();
      for (let tries = 0; tries < 2; tries++) press(item(/^Table 8,/u));
      press(item(/^Table 9,/u));
      expect(within(panel()).getByLabelText('Width')).toHaveProperty('value', '240');
      expect(within(panel()).getByLabelText('Length')).toHaveProperty('value', '76');
      expect(within(panel()).getByLabelText('Seats on the ends')).toHaveProperty('value', '2');
      expect(item(/^Table 9, [a-z]+, \d+ of 8 seats taken/u)).toBeDefined();
    },
  );

  it('opens each field refusal from its own state', SLOW, async () => {
    await seating('fieldBlank');
    expect(await within(panel()).findByText('Enter a name for the table.')).toBeDefined();
    await seating('seatsRange');
    expect(await within(panel()).findByText('Enter a number of seats from 1 to 30.')).toBeDefined();
    await seating('sizeRange');
    expect(await within(panel()).findByText('Enter a size from 40 cm to 10 m.')).toBeDefined();
    await seating('notNumber');
    expect(await within(panel()).findByText('Enter a size from 40 cm to 10 m.')).toBeDefined();
    await seating('endsRange');
    expect(
      await within(panel()).findByText('Enter 0 to 8, no more than the table has seats.'),
    ).toBeDefined();
  });

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

  it('keeps the reset line on a refused change and clears it on a saved one', SLOW, async () => {
    const reset = 'Size reset to the rectangular default, 180 × 76 cm. Seats kept at 10.';

    await seating('tapChooses');
    fireEvent.change(within(panel()).getByLabelText('Shape'), { target: { value: 'rect' } });
    expect(await within(panel()).findByText(reset)).toBeDefined();

    const seats = within(panel()).getByLabelText('Seats');

    fireEvent.change(seats, { target: { value: '31' } });
    key(seats, 'Enter');
    expect(await within(panel()).findByText('Enter a number of seats from 1 to 30.')).toBeDefined();
    expect(within(panel()).getByText(reset)).toBeDefined();

    fireEvent.change(seats, { target: { value: '10' } });
    key(seats, 'Enter');
    await waitFor(() =>
      expect(within(panel()).queryByText('Enter a number of seats from 1 to 30.')).toBeNull(),
    );
    expect(within(panel()).getByText(reset)).toBeDefined();

    fireEvent.change(seats, { target: { value: '8' } });
    key(seats, 'Enter');
    await waitFor(() => expect(within(panel()).queryByText(reset)).toBeNull());

    fireEvent.change(within(panel()).getByLabelText('Shape'), { target: { value: 'round' } });
    expect(await within(panel()).findByText(/^Size reset to the round default/u)).toBeDefined();
  });

  it('marks a chair unusable and back, and refuses a taken one', SLOW, async () => {
    await seating('chair');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Mark unusable' }));
    expect(await within(panel()).findByRole('button', { name: 'Mark usable' })).toBeDefined();
    expect(within(room()).getByRole('button', { name: 'Table 4, Seat 9, Unusable' })).toBeDefined();
    fireEvent.click(
      within(room()).getByRole('button', { name: 'Table 4, Seat 2, Chidi Obi, Coming' }),
    );
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

  it('folds Add row and Add seat into one Add menu when the bar meets the zoom', SLOW, async () => {
    const measured = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const width = this.classList.contains('st-add')
          ? 520
          : this.classList.contains('st-zoom')
            ? 240
            : 0;

        return {
          width,
          height: 0,
          top: 0,
          left: 0,
          right: width,
          bottom: 0,
          x: 0,
          y: 0,
        } as DOMRect;
      });

    try {
      await seating();
      fireEvent.click(await screen.findByRole('button', { name: 'Add' }, WAIT));
      expect(screen.queryByRole('button', { name: 'Add seat' })).toBeNull();
      const menu = screen.getByRole('menu', { name: 'Add' });

      expect(within(menu).getAllByRole('menuitem')).toHaveLength(6);
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Row of chairs' }));
      expect(
        await within(panel()).findByText('Row B added in the nearest free space, with 10 seats.'),
      ).toBeDefined();
      expect(screen.queryByRole('menu')).toBeNull();
    } finally {
      measured.mockRestore();
    }
  });

  it.each([
    [300, false],
    [460, true],
  ])(
    'with the folded bar %i px wide, the zoom steps up above it: %s',
    SLOW,
    async (foldedWidth, up) => {
      const measured = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement) {
          const width = this.classList.contains('st-add')
            ? this.childElementCount > 1
              ? 520
              : foldedWidth
            : this.classList.contains('st-zoom')
              ? 240
              : 0;

          return {
            width,
            height: 0,
            top: 0,
            left: 0,
            right: width,
            bottom: 0,
            x: 0,
            y: 0,
          } as DOMRect;
        });

      try {
        await seating();
        await screen.findByRole('button', { name: 'Add' }, WAIT);
        await waitFor(() =>
          expect(screen.getByRole('group', { name: /^Zoom/ }).closest('.is-zoom-up') != null).toBe(
            up,
          ),
        );
      } finally {
        measured.mockRestore();
      }
    },
  );

  it.each([
    ['zoomAbove', false],
    ['zoomAboveMap', true],
  ])(
    'shows the zoom above the folded bar in English at any width: %s',
    SLOW,
    async (state, map) => {
      await seating(state);
      const zoom = await screen.findByRole('group', { name: /^Zoom/ }, WAIT);

      expect(zoom.closest('.is-zoom-up')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Add' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Add seat' })).toBeNull();
      expect(document.querySelector('.is-zoom-up .st-minimap') !== null).toBe(map);
    },
  );

  it.each([
    [282, false],
    [283, true],
  ])(
    'on a 718 px floor with the views 400 px wide and Saved · Print %i px, Saved · Print step down: %s',
    SLOW,
    async (rightWidth, down) => {
      const measured = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement) {
          const width = this.classList.contains('st-views')
            ? 400
            : this.classList.contains('st-top-right')
              ? rightWidth
              : 0;

          return {
            width,
            height: 0,
            top: 0,
            left: 0,
            right: width,
            bottom: 0,
            x: 0,
            y: 0,
          } as DOMRect;
        });

      try {
        await seating();
        const print = await screen.findByRole('button', { name: 'Print' }, WAIT);

        await waitFor(() => expect(print.closest('.is-row-down') != null).toBe(down));
      } finally {
        measured.mockRestore();
      }
    },
  );

  it('shows Saved · Print a line down in English at any width', SLOW, async () => {
    await seating('rowStepped');
    const print = await screen.findByRole('button', { name: 'Print' }, WAIT);

    expect(print.closest('.is-row-down')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Stop placing' })).toBeDefined();
  });

  it(
    "puts the placing bar's words, Place at the centre and Stop placing in one wrapping row, in that order",
    SLOW,
    async () => {
      await seating('placing');
      const stop = await screen.findByRole('button', { name: 'Stop placing' }, WAIT);
      const body = stop.closest('.st-bar-body');
      const order = [...(body?.querySelectorAll('p, button') ?? [])].map((node) =>
        node.tagName === 'P' ? 'words' : node.textContent,
      );

      expect(order).toEqual(['words', 'Place at the centre', 'Stop placing']);
    },
  );

  it('Esc in a field undoes the typing first, then leaves the table', SLOW, async () => {
    await seating('tapChooses');
    const field = within(panel()).getByLabelText('Seats', { exact: false }) as HTMLInputElement;
    const was = field.value;

    fireEvent.change(field, { target: { value: '3' } });
    key(field, 'Escape');
    expect(field.value).toBe(was);
    expect(within(panel()).getByLabelText('Seats', { exact: false })).toBe(field);
    key(field, 'Escape');
    expect(within(panel()).queryByLabelText('Name', { exact: false })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(item(/^Table 4,/u)), WAIT);
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

  it('refuses a blank or too long name and label, and keeps the old one', SLOW, async () => {
    await seating();
    press(item(/^Table 4,/u));
    expect(typeIn('Name', '').getAttribute('aria-invalid')).toBe('true');
    expect(within(panel()).getByText('Enter a name for the table.')).toBeDefined();
    expect(within(panel()).getByRole('heading', { name: 'Table 4' })).toBeDefined();
    typeIn('Name', 'T'.repeat(31));
    expect(within(panel()).getByText('Use 30 characters or fewer.')).toBeDefined();
    expect(within(panel()).getByRole('heading', { name: 'Table 4' })).toBeDefined();
    press(item(/^Row A,/u));
    typeIn('Label', 'ABCDEFGHIJK');
    expect(within(panel()).getByText('Use 10 characters or fewer.')).toBeDefined();
    typeIn('Label', '');
    expect(within(panel()).getByText('Enter a label for the row.')).toBeDefined();
    press(item(/^By the door,/u));
    typeIn('Name', 'S'.repeat(31));
    expect(within(panel()).getByText('Use 30 characters or fewer.')).toBeDefined();
    typeIn('Name', '');
    expect(within(panel()).getByText('Enter a name for the seat.')).toBeDefined();
    expect(within(panel()).getByRole('heading', { name: 'By the door' })).toBeDefined();
  });

  it('gives focus back to the table when Delete’s ask is kept', SLOW, async () => {
    await seating('deleteTable');
    const ask = screen.getByRole('alertdialog', { name: /^Delete Table 4/u });

    fireEvent.click(within(ask).getByRole('button', { name: 'Keep it' }));
    await waitFor(() => expect(document.activeElement).toBe(item(/^Table 4,/u)));
  });

  it('says a colleague changed the table first (412)', SLOW, async () => {
    await seating('tableChanged');
    expect(
      within(panel()).getByText('Priya Shah just changed this table. Your change was not saved.'),
    ).toBeDefined();
    expect(
      item(/^Table 7, round, 8 of 10 seats taken, Garden side, chosen by Priya Shah$/u),
    ).toBeDefined();
  });

  it('says a colleague changed the row or the seat first (412)', SLOW, async () => {
    await seating('rowChanged');
    expect(
      within(panel()).getByText('Priya Shah just changed this row. Your change was not saved.'),
    ).toBeDefined();
    expect(item(/^Row A,.*chosen by Priya Shah$/u)).toBeDefined();
    await seating('seatChanged');
    expect(
      within(panel()).getByText('Priya Shah just changed this seat. Your change was not saved.'),
    ).toBeDefined();
    expect(item(/^By the door,.*chosen by Priya Shah$/u)).toBeDefined();
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
      fireEvent.keyUp(t9, { key: ' ' });
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
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete' }));
    const ask = screen.getByRole('alertdialog', { name: 'Delete 3 tables?' });

    expect(ask.textContent).toContain('22 guests will be moved to Without a seat.');
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep them' }));
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
      screen.getByText('Priya Shah just moved Table 7. Your change was not saved.'),
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

  it(
    'writes the duplicate key as the computer does, ⌘ D on a Mac and Ctrl D off one',
    SLOW,
    async () => {
      const platform = vi.spyOn(navigator, 'platform', 'get');

      for (const [system, label] of [
        ['MacIntel', '⌘ D'],
        ['Win32', 'Ctrl D'],
      ] as const) {
        platform.mockReturnValue(system);
        await seating('tabOrder');
        const strip = await screen.findByRole('note', { name: 'Keys for the chosen item' });

        expect(within(strip).getByText(label)).toBeDefined();
        cleanup();
      }
      platform.mockRestore();
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

  it(
    'rings two colleagues on one table in turn, and a chosen seat on its chair (#60709)',
    SLOW,
    async () => {
      await seating('presenceSix');
      const rings = (id: string) =>
        [...room().querySelectorAll(`[data-item="${id}"] .st-ring`)].map(
          (ring) => ring.textContent,
        );

      expect(rings('t7')).toEqual(['PS', 'AS']);
      expect(item(/chosen by Priya Shah and Ana Souza$/u)).toBeDefined();
      expect(rings('t9')).toEqual(['JM']);
      expect(item(/, seat 2 chosen by Julien Moreau$/u)).toBeDefined();
      expect(room().querySelector('[data-item="t9"] rect.st-ring-line')).toBeNull();
      expect(room().querySelector('[data-item="t9"] circle.st-ring-line')).not.toBeNull();
    },
  );

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
      await screen.findByText('Priya Shah just moved Table 7. Your change was not saved.'),
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

describe('a colleague’s choice on Tables and the List (sc-60717)', () => {
  const view = (name: 'Floor plan' | 'Tables' | 'List') =>
    fireEvent.click(
      within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name }),
    );
  const card = (name: string) => {
    const found = within(document.querySelector<HTMLElement>('.st-cards')!)
      .getAllByRole('button', { name: new RegExp(`^${name}, `, 'u') })
      .filter((one) => one.classList.contains('st-card-hit'));

    expect(found).toHaveLength(1);
    return found[0]!;
  };
  const ringsOn = (button: HTMLElement) =>
    [...(button.closest('li')?.querySelectorAll('.st-card-ring') ?? [])].map(
      (ring) => ring.textContent,
    );
  const listRow = (name: RegExp) =>
    within(screen.getByRole('table', { name: 'Tables, rows and seats' })).getByRole('button', {
      name,
    });

  it('rings a card in each colleague’s colour, in the order they chose it', SLOW, async () => {
    await seating('presenceTwoTables');
    expect(ringsOn(card('Table 7'))).toEqual(['PS', 'AS']);
    expect(card('Table 7').getAttribute('aria-label')).toMatch(
      /, chosen by Priya Shah and Ana Souza$/u,
    );
    expect(ringsOn(card('Table 4'))).toEqual(['JM', 'TB', 'PS']);
    expect(card('Table 4').getAttribute('aria-label')).toMatch(
      /, chosen by Julien Moreau, Tom Baker and Priya Shah$/u,
    );
    expect(ringsOn(card('Table 2'))).toEqual([]);
    expect(card('Table 2').getAttribute('aria-label')).not.toMatch(/chosen by/u);
  });

  it('marks a colleague’s seat on the card and on its drawing', SLOW, async () => {
    await seating('presenceSeatTables');
    const table = card('Table 9');

    expect(ringsOn(table)).toEqual(['JM']);
    expect(table.getAttribute('aria-label')).toMatch(/, seat 2 chosen by Julien Moreau$/u);
    expect(table.closest('.st-card')?.querySelector('.st-card-art .st-ring')?.textContent).toBe(
      'JM',
    );
  });

  it('shows your Tint and a colleague’s ring on one card', SLOW, async () => {
    await seating('presenceBothTables');
    const table = card('Table 7');

    expect(table.getAttribute('aria-pressed')).toBe('true');
    expect(table.closest('.st-card')?.className).toContain('is-lit');
    expect(ringsOn(table)).toEqual(['PS']);
  });

  it('puts the initials on a List row, and on the chair once it is open', SLOW, async () => {
    await seating('presenceTwoList');
    const row = listRow(/^Table 7.*, chosen by Priya Shah and Ana Souza$/u);

    expect([...row.querySelectorAll('.st-who')].map((one) => one.textContent)).toEqual([
      'PS',
      'AS',
    ]);
    expect(listRow(/^Table 2/u).textContent).not.toMatch(/chosen by/u);
    await seating('presenceSeatList');
    const open = listRow(/^Table 9.*, seat 2 chosen by Julien Moreau$/u);

    expect(open.getAttribute('aria-expanded')).toBe('true');
    const chairs = screen.getAllByText(/^Seat \d+$/u).map((one) => one.closest('tr')!);

    expect(chairs[1]!.textContent).toMatch(/JM.*, chosen by Julien Moreau$/u);
    expect(chairs[0]!.textContent).not.toMatch(/chosen by/u);
  });

  it('keeps every colleague’s choice across View, and behind a filter', SLOW, async () => {
    await seating('presenceChose');
    view('Tables');
    expect(ringsOn(card('Table 7'))).toEqual(['PS']);
    fireEvent.click(screen.getByRole('button', { name: 'Stage side' }));
    expect(screen.queryByRole('button', { name: /^Table 7, /u })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'All sections' }));
    expect(ringsOn(card('Table 7'))).toEqual(['PS']);
    view('List');
    fireEvent.click(screen.getByRole('button', { name: /^All · /u }));
    expect(listRow(/^Table 7.*, chosen by Priya Shah$/u)).toBeDefined();
    view('Floor plan');
    expect(item(/^Table 7, .*chosen by Priya Shah$/u)).toBeDefined();
  });

  it('takes a card chosen on Tables as a choice, and an open row as none', SLOW, async () => {
    await seating('presenceChose');
    view('Tables');
    fireEvent.click(card('Table 3'));
    view('List');
    fireEvent.click(screen.getByRole('button', { name: /^All · /u }));
    fireEvent.click(listRow(/^Table 5/u));
    view('Floor plan');
    expect(item(/^Table 3, /u).getAttribute('aria-pressed')).toBe('true');
    expect(item(/^Table 5, /u).getAttribute('aria-pressed')).toBe('false');
  });

  it('shows no colleague’s mark on either view for a viewer’s choice', SLOW, async () => {
    await seating('presenceViewer');
    view('Tables');
    expect(document.querySelector('.st-card-ring')).toBeNull();
    view('List');
    expect(document.querySelector('.st-who')).toBeNull();
  });

  it.each(['reconnecting', 'left'] as const)(
    'shows no colleague’s mark on any view while %s',
    SLOW,
    async (state) => {
      await seating(state);
      expect(item(/^Table 7, /u).getAttribute('aria-label')).not.toMatch(/chosen by/u);
      view('Tables');
      expect(card('Table 7').getAttribute('aria-label')).not.toMatch(/chosen by/u);
      expect(document.querySelector('.st-card-ring')).toBeNull();
      view('List');
      fireEvent.click(screen.getByRole('button', { name: /^All · /u }));
      expect(screen.queryByRole('button', { name: /^Table 7.*chosen by/u })).toBeNull();
      expect(listRow(/^Table 7/u)).toBeDefined();
      expect(document.querySelector('.st-who')).toBeNull();
    },
  );
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

  it('says on every table whether it has room while a party is picked', SLOW, async () => {
    await seating('picked');
    expect(within(room()).getAllByText('Full').length).toBeGreaterThan(0);
    expect(within(room()).getAllByText(/^\d+ free$/u).length).toBeGreaterThan(1);
    await seating('seat');
    expect(within(room()).queryByText('Full')).toBeNull();
    expect(within(room()).queryByText(/^\d+ free$/u)).toBeNull();
  });

  it(
    'draws each free tag above every item, over its table when the next table is under it',
    SLOW,
    async () => {
      await seating('pickedTight');
      const kids = [...room().children];
      const items = kids.filter((one) => one.classList.contains('st-item'));
      const lastItem = kids.indexOf(items[items.length - 1]!);

      expect(kids.findIndex((one) => one.classList.contains('st-free'))).toBeGreaterThan(lastItem);
      const ring = (name: RegExp) => item(name).querySelector('circle.st-room-for')!;
      const tagBy = (name: RegExp) => {
        const cx = Number(ring(name).getAttribute('cx'));
        const cy = Number(ring(name).getAttribute('cy'));
        const ys = [...room().querySelectorAll('.st-free text')]
          .filter((one) => Math.abs(Number(one.getAttribute('x')) - cx) < 1)
          .map((one) => Number(one.getAttribute('y')));

        return ys.reduce((near, y) => (Math.abs(y - cy) < Math.abs(near - cy) ? y : near));
      };
      const top = (name: RegExp) =>
        Number(ring(name).getAttribute('cy')) - Number(ring(name).getAttribute('r'));
      const bottom = (name: RegExp) =>
        Number(ring(name).getAttribute('cy')) + Number(ring(name).getAttribute('r'));

      expect(tagBy(/^Table 4,/u)).toBeLessThan(top(/^Table 4,/u));
      expect(tagBy(/^Table 3,/u)).toBeGreaterThan(bottom(/^Table 3,/u));
      expect(tagBy(/^Table 10,/u)).toBeGreaterThan(bottom(/^Table 10,/u));
      expect(tagBy(/^Table 6,/u)).toBeGreaterThan(bottom(/^Table 6,/u));
    },
  );

  it('draws no chairs below 50%, so the table is the target', SLOW, async () => {
    await seating('pickedOut');
    expect(within(room()).queryAllByRole('button', { name: /, Seat \d+, /u })).toHaveLength(0);
    expect(within(room()).getAllByText(/^\d+ free$/u).length).toBeGreaterThan(1);
    press(item(/^Table 8,/u));
    expect(await screen.findByText('Kwame Mensah and 1 guest are at Table 8.')).toBeDefined();
  });

  it('labels a chair with its seat, guest and reply on hover and focus', SLOW, async () => {
    await seating('chairLabel');
    expect(within(room()).getByText('Seat 1, Sofia Rossi, Not sure yet')).toBeDefined();
    const chair = within(room()).getByRole('button', {
      name: 'Table 9, Seat 2, Luca Rossi, Coming',
    });

    fireEvent.focus(chair);
    expect(within(room()).getByText('Seat 2, Luca Rossi, Coming')).toBeDefined();
    expect(within(room()).queryByText('Seat 1, Sofia Rossi, Not sure yet')).toBeNull();
    fireEvent.blur(chair);
    expect(within(room()).queryByText('Seat 2, Luca Rossi, Coming')).toBeNull();
  });

  it(
    'draws the chair label under its chair where the bar over the room would hide it',
    SLOW,
    async () => {
      const label = () => within(room()).getByText('Seat 1, Sofia Rossi, Not sure yet');
      const top = () => Number(label().getAttribute('y'));

      await seating('chairLabel');
      const open = top();
      const covered = vi
        .spyOn(Element.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: Element) {
          const [right, bottom] =
            this.classList.contains('st-canvas') || this.classList.contains('st-under-views')
              ? [1280, 800]
              : [0, 0];

          return {
            left: 0,
            top: 0,
            right,
            bottom,
            x: 0,
            y: 0,
            width: right,
            height: bottom,
          } as DOMRect;
        });

      await seating('chairLabel');
      const chair = within(room()).getByRole('button', {
        name: 'Table 9, Seat 1, Sofia Rossi, Not sure yet',
      });
      const cy = Number(chair.getAttribute('cy'));

      expect(top()).toBeGreaterThan(cy);
      expect(open).not.toBe(top());
      covered.mockRestore();
    },
  );

  it('drops the chair label once the pick ends, though the pointer never left', SLOW, async () => {
    await seating('chairLabel');
    key(item(/^Table 9,/u), 'Escape');
    expect(within(room()).queryByText('Seat 1, Sofia Rossi, Not sure yet')).toBeNull();
    await seating('chairLabel');
    const free = within(room()).getAllByRole('button', { name: /^Table 9, Seat \d+, Empty/u })[0]!;

    fireEvent.pointerEnter(free);
    expect(within(room()).getByText(/^Seat \d+, Empty$/u)).toBeDefined();
    fireEvent.click(free);
    expect(await screen.findByText(/ (is|are) at Table 9\.$/u)).toBeDefined();
    expect(within(room()).queryByText(/^Seat \d+, Empty$/u)).toBeNull();
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

  it('says so when no other table has room for everyone at a table', SLOW, async () => {
    await seating('moveAllNone');
    const dialog = screen.getByRole('dialog', { name: /^Table 1,/u });

    expect(
      within(dialog).getByText('No other table has room for all 10. Move them one at a time.'),
    ).toBeDefined();
    expect(within(dialog).queryByText(/^Tables with room/u)).toBeNull();
    expect(within(dialog).queryAllByRole('button')).toHaveLength(0);
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

  it(
    'says an empty table, everyone seated, nobody coming yet, and a search that matches nobody',
    SLOW,
    async () => {
      await seating('emptyTable');
      expect(
        within(panel()).getByText('Nobody here yet. Pick a guest in Seat, then this table.'),
      ).toBeDefined();
      await seating('everyoneSeated');
      expect(
        within(panel()).getAllByText('Everyone who is coming has a seat.').length,
      ).toBeGreaterThan(0);
      await seating('nobodyComing');
      expect(within(panel()).getByText('Nobody has said they’re coming yet.')).toBeDefined();
      expect(within(panel()).queryByText('Everyone who is coming has a seat.')).toBeNull();
      await seating('noMatch');
      expect(within(panel()).getByText('Nobody without a seat matches this search.')).toBeDefined();
      fireEvent.click(within(panel()).getByRole('button', { name: 'Clear search and group' }));
      expect(within(panel()).getByRole('button', { name: /^Marta Silva/u })).toBeDefined();
    },
  );

  it(
    'shows Not sure yet and no reply in the guest’s own words when switched on',
    SLOW,
    async () => {
      await seating('notSureYet');
      expect(within(panel()).getByText('31 more: Not sure yet or No reply')).toBeDefined();
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
    'seats a picked party from a free chair on a card, and swaps on a taken one',
    SLOW,
    async () => {
      await seating('tablesChair');
      fireEvent.click(screen.getByRole('button', { name: 'Table 8, Seat 8, Empty' }));
      expect(await screen.findByText('Kwame Mensah and 1 guest are at Table 8.')).toBeDefined();
      expect(
        screen.getByRole('button', { name: /^Table 8, round, 7 of 10 seats taken/u }),
      ).toBeDefined();
      expect(screen.getByRole('button', { name: 'Table 8, Seat 8, Kwame Mensah' })).toBeDefined();
      expect(screen.getByRole('button', { name: /^Table 8, Seat 9, / })).toBeDefined();

      await seating('tablesSwap');
      const ask = screen.getByRole('dialog', { name: /^Table 4,/u });

      expect(within(ask).getByText('Table 4, seat 3 is Funmi Adeyemi’s.')).toBeDefined();
      fireEvent.click(within(ask).getByRole('button', { name: 'Swap with Funmi Adeyemi' }));
      expect(await screen.findByText('Lucía Ortega is at Table 4.')).toBeDefined();
      expect(within(panel()).getByRole('button', { name: /^Funmi Adeyemi/u })).toBeDefined();
    },
  );

  it('picks a seated guest from a card’s chair and moves only them', SLOW, async () => {
    await seating('tables');
    fireEvent.click(screen.getByRole('button', { name: 'Table 4, Seat 3, Funmi Adeyemi' }));
    expect(screen.getByText('Now pick a table for Funmi Adeyemi.')).toBeDefined();
    expect(
      within(panel()).getByRole('button', { name: /^Seat 3 Funmi Adeyemi/u, pressed: true }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^Table 8, round, 5 of 10/u }));
    expect(await screen.findByText('Funmi Adeyemi is at Table 8.')).toBeDefined();
    expect(screen.getByRole('button', { name: /^Table 4, round, 7 of 10/u })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Table 8, Seat 6, Funmi Adeyemi' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Table 4, Seat 3, Funmi Adeyemi' })).toBeDefined();
  });

  it(
    'picks a seated guest in Seat, swaps two seated guests, and drops a pick on their own chair',
    SLOW,
    async () => {
      await seating('tablesMoving');
      fireEvent.click(screen.getByRole('button', { name: 'Table 8, Seat 1, Amara Diallo' }));
      fireEvent.click(
        within(screen.getByRole('dialog', { name: /^Table 8,/u })).getByRole('button', {
          name: 'Swap with Amara Diallo',
        }),
      );
      expect(await screen.findByText('Funmi Adeyemi is at Table 8.')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Table 4, Seat 3, Amara Diallo' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Table 8, Seat 1, Funmi Adeyemi' })).toBeDefined();

      await seating('tableGuests');
      fireEvent.click(within(panel()).getByRole('button', { name: /^Seat 3 Funmi Adeyemi/u }));
      expect(screen.getByText('Now pick a table for Funmi Adeyemi.')).toBeDefined();
      fireEvent.click(within(panel()).getByRole('button', { name: /^Seat 3 Funmi Adeyemi/u }));
      expect(screen.queryByText('Now pick a table for Funmi Adeyemi.')).toBeNull();

      await seating('tablesMoving');
      fireEvent.click(screen.getByRole('button', { name: 'Table 4, Seat 3, Funmi Adeyemi' }));
      expect(screen.queryByText('Now pick a table for Funmi Adeyemi.')).toBeNull();
    },
  );

  it('finishes a move picked on Tables from the List', SLOW, async () => {
    await seating('tablesMoving');
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByText('Now pick a table for Funmi Adeyemi.')).toBeDefined();
    const table8 = screen
      .getAllByRole('row')
      .find((row) => row.querySelector('th')?.textContent?.startsWith('Table 8'));

    fireEvent.click(within(table8!).getByRole('button', { name: 'Seat here' }));
    expect(await screen.findByText('Funmi Adeyemi is at Table 8.')).toBeDefined();
  });

  it('keeps chairs out of reach when read only', SLOW, async () => {
    await seating('readOnly');
    fireEvent.click(screen.getByRole('button', { name: 'Tables' }));
    expect(screen.queryByRole('button', { name: /^Table 4, Seat 3, / })).toBeNull();
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

  it('writes a seated chair’s guest alone in the List, with no reply (sc-5030)', SLOW, async () => {
    await seating('listOpen');
    const seat1 = screen.getAllByRole('row').find((row) => row.textContent?.startsWith('Seat 1'));

    expect(within(seat1!).getByText('Amara Diallo')).toBeDefined();
    expect(within(seat1!).queryByText(/, Coming$/u)).toBeNull();
  });
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
        'You can view and print this plan, but not change it.',
      ),
    ).toBeDefined();
  });

  it(
    'prints the floor plan, the table lists and a table card in black and white',
    SLOW,
    async () => {
      open(`${AT}?state=paperFloor`);
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Floor plan' }, WAIT),
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
      await screen.findByRole('heading', { level: 1, name: 'Table lists' }, WAIT),
    ).toBeDefined();
    expect(screen.getByText('Page 1 of 3')).toBeDefined();
    expect(screen.getAllByText('Empty').length).toBeGreaterThan(4);
  });

  it('folds a table card with its name on both halves', SLOW, async () => {
    open(`${AT}?state=paperCardTop`);
    expect(await screen.findAllByText('Top table', undefined, WAIT)).toHaveLength(2);
    expect(screen.getByText('Page 13 of 13')).toBeDefined();
  });
});

describe('the breadcrumb (sc-55300)', () => {
  const LONG =
    'Adaeze & Tunde’s wedding weekend, with both families from Lagos, London and Accra, the church, the dinner and the brunch';

  it('names the long event in full to the link, the cut being only drawn', SLOW, async () => {
    await seating('longName');
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const event = within(crumb).getByRole('link', { name: LONG });

    expect(event.getAttribute('href')).toBe('/demo/events/evt-wed-4');
    expect(event.querySelector('.st-crumb-name')).not.toBeNull();
    expect(within(crumb).getByRole('link', { name: 'Events' }).getAttribute('href')).toBe(
      '/demo/events',
    );
  });

  it('speaks French in French, Plan de table still the heading', SLOW, async () => {
    open(`${AT}?state=longNameFr`);
    await screen.findByRole('heading', { level: 1, name: 'Plan de table' }, WAIT);
    const crumb = screen.getByRole('navigation', { name: 'Fil d’Ariane' });

    expect(crumb.getAttribute('lang')).toBe('fr');
    expect(within(crumb).getByRole('link', { name: 'Événements' })).toBeDefined();
    expect(within(crumb).getByRole('link', { name: LONG })).toBeDefined();
  });

  it('draws the header band at 320 and 375 in English and French', SLOW, async () => {
    open(`${AT}?state=crumbWidths`);
    await screen.findByRole(
      'heading',
      { level: 1, name: 'The header band in a narrow window' },
      WAIT,
    );

    expect(screen.getAllByRole('navigation', { name: 'Breadcrumb' })).toHaveLength(2);
    expect(screen.getAllByRole('navigation', { name: 'Fil d’Ariane' })).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Seating words QA' })).toBeDefined();
  });

  it('rings one link in each frame, each link at each width (sc-57088)', SLOW, async () => {
    open(`${AT}?state=crumbFocus`);
    await screen.findByRole(
      'heading',
      { level: 1, name: 'A focused link in the breadcrumb' },
      WAIT,
    );
    const frames = screen.getAllByRole('figure');
    const ringed = frames.map((frame) => {
      const rings = frame.querySelectorAll('a.is-ring');

      expect(rings).toHaveLength(1);
      return `${frame.className} ${rings[0]?.textContent ?? ''}`;
    });

    expect(frames).toHaveLength(13);
    expect(ringed).toContain('st-width is-1280 Events');
    expect(ringed).toContain('st-width is-1280 Événements');
    expect(ringed).toContain(`st-width is-320 ${LONG}`);
    expect(ringed).toContain('st-width is-375 Seating words QA');
    expect(frames[2]?.querySelector('figcaption')?.textContent).toMatch(
      /^1280 px · French · .+ · focus on Événements$/u,
    );
  });
});
