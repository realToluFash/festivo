import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { ROOM, type Point, fitOf } from './seating.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/seating';
const CANVAS = { w: 718, h: 719 };

async function seating(state?: string) {
  cleanup();
  const router = createMemoryRouter(routes, {
    initialEntries: [state == null ? AT : `${AT}?state=${state}`],
  });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Seating' }, WAIT);
}

function panel(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Panel' });
}

function room(): HTMLElement {
  return screen.getByRole('group', { name: /^Floor plan, Main hall/u });
}

function item(name: RegExp): HTMLElement {
  const found = within(room())
    .getAllByRole('button', { name })
    .filter((one) => (one.getAttribute('aria-label') ?? '').includes('seats taken'));

  expect(found).toHaveLength(1);
  return found[0]!;
}

function chosen(): string | null {
  return within(panel()).queryByRole('heading', { name: /chosen$/u })?.textContent ?? null;
}

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

function onScreen([x, y]: Point): Point {
  const { s, ox, oy } = fitOf(CANVAS.w, CANVAS.h, ROOM);

  return [ox + x * s, oy + y * s];
}

function drawBox(from: Point, to: Point, options: { shiftKey?: boolean } = {}): void {
  const [x0, y0] = onScreen(from);
  const [x1, y1] = onScreen(to);

  fireEvent.pointerDown(room(), { button: 0, pointerId: 1, clientX: x0, clientY: y0, ...options });
  fireEvent.pointerMove(window, { pointerId: 1, clientX: x1, clientY: y1 });
  expect(document.querySelector('.st-box-drawn')).not.toBeNull();
  fireEvent.pointerUp(window, { pointerId: 1, clientX: x1, clientY: y1 });
}

function apply(): void {
  fireEvent.click(within(panel()).getByRole('button', { name: 'Apply' }));
}

function said(): string {
  return screen
    .getAllByRole('status')
    .map((one) => one.textContent ?? '')
    .join(' | ');
}

function across(name: RegExp): string {
  press(item(name));
  return (within(panel()).getByLabelText('Across') as HTMLInputElement).value;
}

beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class StandIn extends MouseEvent {
      pointerId: number;
      pointerType: string;

      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'mouse';
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

describe('choosing many (sc-4717)', () => {
  it('draws a box on empty floor and chooses what it touches; Shift adds', SLOW, async () => {
    await seating();
    drawBox([250, 450], [960, 1100]);
    expect(chosen()).toBe('4 chosen');
    expect(document.querySelector('.st-box-drawn')).toBeNull();
    press(room());
    expect(chosen()).toBeNull();
    press(item(/^Table 10,/u));
    drawBox([250, 450], [960, 1100], { shiftKey: true });
    expect(chosen()).toBe('5 chosen');
  });

  it('adds and takes out with Add to choice, keeping the choice on Esc', SLOW, async () => {
    await seating();
    const toggle = screen.getByRole('button', { name: 'Add to choice' });

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/^Tap or click items to add them or take them out\./u)).toBeDefined();
    expect(screen.getByRole('note', { name: 'While Add to choice is on' })).toBeDefined();
    press(item(/^Table 1,/u));
    press(item(/^Table 5,/u));
    press(item(/^Table 6,/u));
    expect(chosen()).toBe('3 chosen');
    press(item(/^Table 6,/u));
    expect(chosen()).toBe('2 chosen');
    press(room());
    expect(chosen()).toBe('2 chosen');
    drawBox([100, 1400], [900, 1740]);
    expect(chosen()).toBe('4 chosen');
    expect(
      within(panel()).getByText('2 tables · 1 row · 1 single seat · 25 guests seated'),
    ).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(chosen()).toBe('4 chosen');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(chosen()).toBeNull();
  });

  it('chooses everything with Select all and Ctrl+A, and by kind', SLOW, async () => {
    await seating();
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(chosen()).toBe('16 chosen');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(chosen()).toBeNull();
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true });
    expect(chosen()).toBe('16 chosen');
    fireEvent.click(screen.getByRole('button', { name: 'Select all of a kind' }));
    const menu = screen.getByRole('menu', { name: 'Select all of a kind' });
    const lines = within(menu)
      .getAllByRole('menuitem')
      .map((one) => one.textContent);

    expect(lines).toEqual([
      'Round tables9',
      'Rectangular tables1',
      'Head tables1',
      'Cocktail tables2',
      'Rows1',
      'Single seats2',
      'Room featuresNone',
      'Stage side5',
      'Garden side5',
      'By the bar2',
    ]);
    expect(
      within(menu)
        .getByRole('menuitem', { name: /Room features/u })
        .hasAttribute('disabled'),
    ).toBe(true);
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Round tables/u }));
    expect(chosen()).toBe('9 chosen');
  });

  it('lines up on the left edge as one step, and Undo puts them back', SLOW, async () => {
    await seating('selection');
    expect(within(panel()).getByText('6 tables · 55 guests seated')).toBeDefined();
    const left = within(panel()).getByRole('button', { name: 'Left' });

    expect(left.getAttribute('aria-describedby')).toBe('st-tip-left');
    expect(document.getElementById('st-tip-left')?.textContent).toBe('Line up their left edges');
    fireEvent.click(left);
    expect(said()).toContain('6 tables lined up on their left edges.');
    expect(across(/^Table 2,/u)).toBe('4.20 m');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(across(/^Table 2,/u)).toBe('8.10 m');
  });

  it('spaces evenly from 3, and says why not with 2', SLOW, async () => {
    await seating('spaceTwo');
    expect(within(panel()).getByRole('button', { name: 'Across' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(within(panel()).getByText('Choose 3 or more to space evenly.')).toBeDefined();
    press(item(/^Table 1,/u));
    press(item(/^Table 2,/u), { shiftKey: true });
    press(item(/^Table 4,/u), { shiftKey: true });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Across' }));
    expect(said()).toContain('3 tables spaced evenly across.');
    expect(across(/^Table 2,/u)).toBe('10.05 m');
  });

  it('previews a grid, applies it, and refuses one past the wall or too wide', SLOW, async () => {
    await seating('gridOpen');
    expect(document.querySelectorAll('.st-outline')).toHaveLength(6);
    expect(document.querySelectorAll('.st-outline.is-amber')).toHaveLength(0);
    apply();
    expect(said()).toContain('6 tables set in a grid of 3 columns.');
    await seating('gridWall');
    expect(document.querySelectorAll('.st-outline.is-amber').length).toBeGreaterThan(0);
    apply();
    expect(screen.getByRole('alert').textContent).toBe(
      'Table 9 would sit outside the room, so nothing moved.',
    );
    await seating('gridWide');
    apply();
    expect(screen.getByRole('alert').textContent).toMatch(
      /^This grid is [\d.]+ m wide; the room is 24 m\.$/u,
    );
  });

  it('checks Columns and Gap on press, in metres and in feet', SLOW, async () => {
    await seating('selection');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Arrange in a grid' }));
    fireEvent.change(within(panel()).getByLabelText('Columns'), { target: { value: '0' } });
    fireEvent.change(within(panel()).getByLabelText('Gap (m)'), { target: { value: '12' } });
    apply();
    expect(within(panel()).getByText('Enter a number of columns from 1 to 20.')).toBeDefined();
    expect(within(panel()).getByText('Enter a gap from 0 to 10 m.')).toBeDefined();
    await seating('gridFeet');
    apply();
    expect(within(panel()).getByText('Enter a gap from 0 to 32 ft.')).toBeDefined();
    fireEvent.change(within(panel()).getByLabelText('Gap (ft)'), { target: { value: '3' } });
    apply();
    expect(said()).toContain('6 tables set in a grid of 3 columns.');
  });

  it('renumbers in reading order, refusing a name another table has', SLOW, async () => {
    await seating('renumberClash');
    apply();
    expect(
      within(panel()).getByText('Table 7 is already taken by a table you didn’t choose.'),
    ).toBeDefined();
    fireEvent.change(within(panel()).getByLabelText('Start at'), { target: { value: '21' } });
    apply();
    expect(said()).toContain('5 tables renumbered from 21 to 25');
    expect(item(/^Table 21, round, 10 of 10 seats taken, Stage side$/u)).toBeDefined();
  });

  it('sets one section for every chosen table', SLOW, async () => {
    await seating('sectionOpen');
    apply();
    expect(said()).toContain('5 tables now in Stage side.');
    expect(item(/^Table 9,.*Stage side$/u)).toBeDefined();
  });

  it('duplicates the choice and leaves the copies chosen', SLOW, async () => {
    await seating();
    press(item(/^Table 6,/u));
    press(item(/^Table 7,/u), { shiftKey: true });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Duplicate' }));
    expect(said()).toContain('2 copies added 50 cm down and to the right');
    expect(chosen()).toBe('2 chosen');
    expect(item(/^Table 11, round, 0 of 10 seats taken, Garden side$/u)).toBeDefined();
  });

  it('asks before deleting many, frees their guests, and undoes', SLOW, async () => {
    await seating('deleteMany');
    const ask = screen.getByRole('alertdialog', { name: 'Delete 6 tables?' });

    expect(ask.textContent).toContain('55 guests will be moved to Without a seat.');
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete 6 tables' }));
    expect(said()).toContain('6 tables deleted. 55 guests moved to Without a seat.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(item(/^Table 1,/u)).toBeDefined();
    await seating('deleteManyEmpty');
    expect(screen.getByRole('alertdialog').textContent).toContain('Nobody is seated in them.');
    await seating('deleteMixed');
    expect(screen.getByRole('alertdialog', { name: 'Delete 3 items?' })).toBeDefined();
  });

  it('says a colleague’s change refused the step and keeps the choice', SLOW, async () => {
    await seating('toolChanged');
    expect(
      screen.getByText(
        'Priya Shah changed Table 5 after you chose it, so nothing moved. The plan now shows the change; try again.',
      ),
    ).toBeDefined();
    expect(chosen()).toBe('5 chosen');
  });

  it('offers nothing to choose for changing without seating.manage', SLOW, async () => {
    await seating('readOnlyMany');
    expect(screen.queryByRole('button', { name: 'Select all' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add to choice' })).toBeNull();
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true });
    expect(chosen()).toBeNull();
  });
});
