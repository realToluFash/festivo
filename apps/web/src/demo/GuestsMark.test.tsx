import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const WAIT = { timeout: 8000 };
const SLOW = { timeout: 20000 };

async function open(state: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/guests/select?state=${state}`],
  });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Guests' }, WAIT);
}

function bar(): HTMLElement {
  return screen.getByRole('region', { name: 'Selected guests' });
}

function said(): string {
  return screen.getByRole('status').textContent ?? '';
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('Mark as invited from the selection bar (sc-46880)', () => {
  it('puts Mark as invited first in the bar, and counts the selection', SLOW, async () => {
    await open('selected');

    const names = within(bar())
      .getAllByRole('button')
      .map((one) => one.textContent);

    expect(names.slice(0, 3)).toEqual(['Mark as invited', 'Add to group', 'Remove from the list']);
    expect(bar().textContent).toContain('12 selected');
  });

  it('asks how, refuses a blank press, and marks the Not yet invited', SLOW, async () => {
    await open('selected');
    fireEvent.click(within(bar()).getByRole('button', { name: 'Mark as invited' }));

    const dialog = await screen.findByRole('dialog', { name: 'Mark 9 guests as invited' });

    expect(dialog.textContent).toContain('3 already invited, who stay as recorded:');
    expect(document.activeElement).toBe(within(dialog).getByRole('radio', { name: 'WhatsApp' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark as invited' }));
    expect(dialog.textContent).toContain('Choose how you invited them.');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'In person' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark as invited' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(said()).toBe('9 marked as invited, in person.3 already invited, left as it was.');
    expect(screen.queryByRole('region', { name: 'Selected guests' })).toBeNull();
  });

  it('Cancel sends nothing and keeps the selection', SLOW, async () => {
    await open('ask');
    const dialog = await screen.findByRole('dialog', { name: 'Mark 6 guests as invited' });

    expect(dialog.textContent).not.toContain('already invited');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bar().textContent).toContain('6 selected');
  });

  it('names five already invited, then the rest as a count', SLOW, async () => {
    await open('askAlready');
    const dialog = await screen.findByRole('dialog', { name: 'Mark 6 guests as invited' });

    expect(dialog.textContent).toMatch(/8 already invited, who stay as recorded: .+ and 3 more\./u);
  });

  it('shows Nothing to mark when everyone selected is already invited', SLOW, async () => {
    await open('nothing');

    expect(said()).toBe('4 already invited. Nothing to mark.');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it(
    'keeps the selection on a failure, and Try again marks with the same choice',
    SLOW,
    async () => {
      await open('failed');

      expect(said()).toContain('Nothing changed. We could not reach Soirely.');
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(said()).toBe('9 marked as invited, WhatsApp.3 already invited, left as it was.');
    },
  );

  it('takes Mark as invited out of the bar once the event is no longer live', SLOW, async () => {
    await open('notLive');

    expect(said()).toBe(
      'Nothing changed. This event is no longer live, so guests can’t be marked as invited.',
    );
    fireEvent.click(screen.getAllByRole('checkbox')[1] as HTMLElement);
    expect(within(bar()).queryByRole('button', { name: 'Mark as invited' })).toBeNull();
  });

  it('opens nothing over 2,000, and says how to narrow', SLOW, async () => {
    await open('over');

    expect(bar().textContent).toContain('You can act on up to 2,000 guests at once.');
    fireEvent.click(within(bar()).getByRole('button', { name: 'Mark as invited' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has no Mark as invited on a paused event', SLOW, async () => {
    await open('paused');

    expect(within(bar()).queryByRole('button', { name: 'Mark as invited' })).toBeNull();
    expect(within(bar()).getByRole('button', { name: 'Add to group' })).toBeTruthy();
  });

  it('reports a guest someone else removed', SLOW, async () => {
    await open('markedRemoved');

    expect(said()).toContain('1 not changed: someone else removed them.');
  });
});
