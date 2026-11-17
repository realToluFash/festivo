import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/seating';

async function seating(state: string) {
  cleanup();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`${AT}?state=${state}`] })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: 'Seating' }, WAIT);
}

function card(): HTMLElement {
  return screen.getByRole('region', { name: 'Share tables with guests' });
}

function ask(): HTMLElement {
  return screen.getByRole('alertdialog');
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('Share tables with guests (sc-4022)', () => {
  it('says who has no seat, asks first, and then says the tables are shared', SLOW, async () => {
    await seating('shareNotShared');

    expect(card().textContent).toContain(
      'Guests who are coming will see their table on their page. You can still change the plan.',
    );
    expect(card().textContent).toContain('12 guests don’t have a seat yet.');

    fireEvent.click(within(card()).getByRole('button', { name: 'Share tables with guests' }));
    expect(within(ask()).getByRole('heading').textContent).toBe('Share tables with guests?');
    expect(ask().textContent).toContain(
      '12 guests who are coming don’t have a seat yet. They’ll see nothing about seating until they do.',
    );

    fireEvent.click(within(ask()).getByRole('button', { name: 'Share tables' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(card().textContent).toContain('Tables are shared with guests');
    expect(card().textContent).toContain('Since Tue, Nov 3.');
  });

  it('leaves out the unseated lines once every Coming guest has a seat', SLOW, async () => {
    await seating('shareAllSeated');
    expect(card().textContent).not.toContain('have a seat yet');

    fireEvent.click(within(card()).getByRole('button', { name: 'Share tables with guests' }));
    expect(ask().textContent).not.toContain('have a seat yet');
  });

  it(
    'refuses a Share by on the event’s day beside the field, and saves one before it',
    SLOW,
    async () => {
      await seating('shareNotShared');
      const field = within(card()).getByLabelText('Share by', { exact: false });

      fireEvent.change(field, { target: { value: '2026-11-05' } });
      fireEvent.click(within(card()).getByRole('button', { name: 'Save the date' }));
      expect(within(card()).getByRole('alert').textContent).toBe(
        'Choose a date before the event, Thu, Nov 5.',
      );

      fireEvent.change(field, { target: { value: '2026-11-04' } });
      fireEvent.click(within(card()).getByRole('button', { name: 'Save the date' }));
      expect(card().textContent).toContain(
        'Share tables by Wed, Nov 4. Nothing is shared until you share it.',
      );
      expect(within(card()).getByRole('button', { name: 'Change' })).toBeTruthy();
    },
  );

  it('keeps a passed Share by with Change, Remove and a Passed marker', SLOW, async () => {
    await seating('shareByPassed');

    expect(within(card()).getByText('Passed')).toBeTruthy();
    expect(card().textContent).toContain('That date has passed, and nothing is shared yet.');
    fireEvent.click(within(card()).getByRole('button', { name: 'Remove' }));
    expect(within(card()).queryByText('Passed')).toBeNull();
    expect(within(card()).getByLabelText('Share by', { exact: false })).toBeTruthy();
  });

  it('tries again from a share that failed', SLOW, async () => {
    await seating('shareFailed');

    expect(within(ask()).getByRole('alert').textContent).toContain(
      'We could not share the tables.',
    );
    fireEvent.click(within(ask()).getByRole('button', { name: 'Share tables' }));
    expect(card().textContent).toContain('Tables are shared with guests');
  });

  it('asks before it stops, and brings the saved Share by back', SLOW, async () => {
    await seating('shareShared');
    expect(within(card()).queryByLabelText('Share by', { exact: false })).toBeNull();

    fireEvent.click(within(card()).getByRole('button', { name: 'Stop sharing' }));
    expect(within(ask()).getByRole('heading').textContent).toBe('Stop sharing tables?');
    fireEvent.click(within(ask()).getByRole('button', { name: 'Stop sharing' }));

    expect(card().textContent).toContain('Guests’ pages no longer show their table.');
    expect(card().textContent).toContain('Share tables by Wed, Nov 4.');
  });

  it(
    'shows the state and date without a button to anyone without seating.manage',
    SLOW,
    async () => {
      await seating('shareReadOnly');
      expect(within(card()).queryAllByRole('button')).toHaveLength(0);
      expect(card().textContent).toContain('Wed, Nov 4');
      expect(card().textContent).toContain(
        'You can see this. Changing it needs the Manage seating permission.',
      );

      await seating('shareReadOnlyShared');
      expect(within(card()).queryAllByRole('button')).toHaveLength(0);
      expect(card().textContent).toContain('Tables are shared with guests');
    },
  );
});
