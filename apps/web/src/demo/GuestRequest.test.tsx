import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };
const AT = '/demo/settings/data-and-control/guest-request';
const FIELD = 'Their email address or mobile number';

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

async function request(query = '') {
  open(`${AT}${query}`);
  await screen.findByRole('heading', { level: 1, name: 'A guest’s request' }, FIRST_LOAD);
}

async function emeka(data: string, as = '') {
  open(`/demo/guests?state=guest&data=${data}${as}`);
  await screen.findByRole('heading', { level: 1, name: 'Guests' }, FIRST_LOAD);
}

function theirData(): HTMLElement {
  return screen.getByRole('region', { name: 'Their data' });
}

describe('Data and control › A guest’s request (sc-30193)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('checks before it finds, says so beside the field, and keeps the focus there', async () => {
    await request();
    const field = screen.getByLabelText(FIELD);

    expect(document.activeElement).toBe(field);
    fireEvent.click(screen.getByRole('button', { name: 'Find their records' }));
    expect(screen.getByText('Enter their email address or mobile number.')).toBeDefined();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field);

    fireEvent.change(field, { target: { value: 'emeka nwosu' } });
    fireEvent.submit(field);
    expect(
      screen.getByText('Enter an email address, or a mobile number with its country code.'),
    ).toBeDefined();

    fireEvent.change(field, { target: { value: 'nobody@example.com' } });
    fireEvent.submit(field);
    expect(
      screen.getByText('No guest in Ire Events has that email address or mobile number.'),
    ).toBeDefined();
  });

  it('finds Dr Emeka Nwosu by his number, then Their data as on his details', async () => {
    await request();
    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: '+44 7700 900231' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find their records' }));
    const block = theirData();

    expect(
      within(block).getByText(
        'A request covers every record of theirs in Ire Events: 4 records, on 3 events.',
      ),
    ).toBeDefined();
    expect(within(block).getByText('Companion of Dr Emeka Nwosu')).toBeDefined();
    expect(within(block).getByText('Deleted event')).toBeDefined();
    expect(within(block).getByRole('button', { name: 'Export their data' })).toBeDefined();
    expect(within(block).getByRole('button', { name: 'Erase from every event…' })).toBeDefined();
  });

  it('erases from every event in Play: the question, Erasing…, erased', async () => {
    await request('?state=found');
    fireEvent.click(screen.getByRole('button', { name: 'Erase from every event…' }));
    const ask = screen.getByRole('alertdialog', { name: 'Erase Dr Emeka Nwosu from every event?' });

    expect(document.activeElement).toBe(
      within(ask).getByRole('button', { name: 'Keep their data' }),
    );
    expect(within(ask).getByText('AC, not yet built')).toBeDefined();
    expect(within(ask).getByText('This can’t be undone.')).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Erase from every event' }));

    expect(screen.getByText('Erasing…')).toBeDefined();
    await waitFor(
      () =>
        expect(
          screen.getByText(
            'Erased on Monday, Oct 19 at 10:12 WAT. Their reply, seat and place in the counts stay.',
          ),
        ).toBeDefined(),
      { timeout: 3000 },
    );
  });

  it('loads, and fails with a way to try again', async () => {
    await request('?state=failed');

    expect(screen.getByText('We could not load A guest’s request.')).toBeDefined();
  });
});

describe('Their data on Dr Emeka Nwosu’s details in Guests (sc-30193)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('sits at the foot of his details for an owner, and not for a member', async () => {
    await emeka('covered');

    expect(
      within(theirData()).getAllByText('Dr Emeka Nwosu', { selector: '.desk-row-name' }),
    ).toHaveLength(2);
    expect(
      within(theirData()).getByText(
        'A record that is not theirs? Correct its email address or mobile number with Edit, and it leaves this list.',
      ),
    ).toBeDefined();
  });

  it('shows a member none', async () => {
    await emeka('member');

    expect(screen.queryByRole('region', { name: 'Their data' })).toBeNull();
  });

  it('exports their data in Play: preparing, ready, Download', async () => {
    await emeka('covered');
    fireEvent.click(within(theirData()).getByRole('button', { name: 'Export their data' }));

    expect(within(theirData()).getByText('Preparing their export…')).toBeDefined();
    await waitFor(
      () =>
        expect(
          within(theirData()).getByText(
            'Their export is ready. It downloads once, until Tuesday, Oct 20 at 10:20 WAT, and only for you.',
          ),
        ).toBeDefined(),
      { timeout: 4000 },
    );
    fireEvent.click(within(theirData()).getByRole('button', { name: 'Download' }));
    expect(within(theirData()).getByRole('button', { name: 'Export their data' })).toBeDefined();
  });

  it.each([
    ['failed', 'Their export did not finish.', 'Try again'],
    ['link_used', 'This download has been used or has expired.', 'Export their data'],
    [
      'other_admin',
      'A request covers every record of theirs in Ire Events: 4 records, on 3 events.',
      'Export their data',
    ],
  ])('opens %s with its words and its way on', async (state, words, verb) => {
    await emeka(state);

    expect(within(theirData()).getByText(words)).toBeDefined();
    expect(within(theirData()).getByRole('button', { name: verb })).toBeDefined();
  });

  it('says the records changed, now 5, and asks again', async () => {
    await emeka('set_changed_export');

    expect(
      within(theirData()).getByText(
        'The records this covers have changed. Check them, then ask again.',
      ),
    ).toBeDefined();
    expect(
      within(theirData()).getByText('Kemi’s baby shower · Saturday, Oct 24 · Same email address'),
    ).toBeDefined();
    fireEvent.click(within(theirData()).getByRole('button', { name: 'Export their data' }));
    expect(
      within(theirData()).queryByText(
        'The records this covers have changed. Check them, then ask again.',
      ),
    ).toBeNull();
  });

  it('opens the question with the changed line and the 5 records', async () => {
    await emeka('set_changed_erase');
    const ask = screen.getByRole('alertdialog', { name: 'Erase Dr Emeka Nwosu from every event?' });

    expect(
      within(ask).getByText('The records this covers have changed. Check them, then ask again.'),
    ).toBeDefined();
    expect(within(ask).getAllByText(/Nwosu$/u, { selector: '.desk-row-name' })).toHaveLength(5);
  });

  it('reads Erasing… with nothing to change, then Erased guest', async () => {
    await emeka('erasing');

    expect(screen.getAllByText('Erasing…').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Record a reply' })).toBeNull();
  });

  it('shows an erased guest with their reply kept, and nothing else', async () => {
    await emeka('erased');
    const column = document.querySelector<HTMLElement>('.gs-column') ?? document.body;

    expect(within(column).getByRole('heading', { level: 2, name: 'Erased guest' })).toBeDefined();
    expect(
      within(column).getByText(
        'Erased on Monday, Oct 19 at 10:12 WAT. Their reply, seat and place in the counts stay.',
      ),
    ).toBeDefined();
    expect(within(column).queryByText('emeka.nwosu@nhs.net')).toBeNull();
    expect(within(column).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(column).queryByRole('region', { name: 'Their data' })).toBeNull();
  });
});
