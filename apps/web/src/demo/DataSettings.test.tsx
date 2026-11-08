import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };

async function data(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Data' }, FIRST_LOAD);
}

function block(name: string | RegExp): HTMLElement {
  return screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
}

function pick(period: string) {
  fireEvent.click(screen.getByRole('button', { name: /^Delete guest data after an event: / }));
  fireEvent.click(screen.getByRole('menuitemradio', { name: period }));
}

describe('Settings > Data at a desk (sc-30194)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('opens from the Settings list', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/settings'] });
    render(<RouterProvider router={router} />);
    const list = await screen.findByRole('navigation', { name: 'Settings' }, FIRST_LOAD);

    fireEvent.click(within(list).getByRole('link', { name: 'Data' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Data' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/settings/data');
  });

  it('gives a member nothing at Data’s address', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/demo/settings/data?as=ana'],
    });
    render(<RouterProvider router={router} />);
    const list = await screen.findByRole('navigation', { name: 'Settings' }, FIRST_LOAD);

    expect(within(list).queryByRole('link', { name: 'Data' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: 'Data' })).toBeNull();
  });

  it('is Off by default and offers exactly the five periods', async () => {
    await data('/demo/settings/data');

    expect(screen.getByText('Guests’ details are kept after an event')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Choose a period' }));
    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'Off',
      '30 days',
      '90 days',
      '180 days',
      '365 days',
    ]);
  });

  it('asks before turning on, the count following the period as it is picked', async () => {
    await data('/demo/settings/data');
    pick('90 days');
    const dialog = screen.getByRole('dialog', { name: 'Delete guest data?' });

    expect(
      within(dialog).getByText(
        /^2 events ended more than 90 days ago, so their guests are in the first run, on .* at 14:20 WAT\.$/u,
      ),
    ).toBeDefined();
    expect(within(dialog).getByText('Owners and Admins are emailed now.')).toBeDefined();
    expect(within(dialog).getByText('Erased details can’t come back.')).toBeDefined();
    expect(within(dialog).getByText('Adunni & Femi’s wedding')).toBeDefined();

    fireEvent.click(within(dialog).getByRole('radio', { name: '180 days' }));
    expect(within(dialog).getByText(/^1 event ended .* so its guests are in/u)).toBeDefined();

    fireEvent.click(within(dialog).getByRole('radio', { name: '365 days' }));
    expect(within(dialog).getByText(/^No event ended .* erases nothing yet\.$/u)).toBeDefined();
    expect(within(dialog).queryByText('Owners and Admins are emailed now.')).toBeNull();
    expect(within(dialog).queryByRole('radio', { name: 'Off' })).toBeNull();
  });

  it('changes nothing until the verb, and shows the run once turned on', async () => {
    await data('/demo/settings/data');
    pick('90 days');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /event: Off$/u })).toBeDefined();

    pick('90 days');
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));

    expect(screen.getByRole('button', { name: /event: 90 days$/u })).toBeDefined();
    expect(block(/^Next run · .* at 14:20 WAT$/u)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Hold back Lumen Studio launch' })).toBeDefined();
  });

  it('turns Off at once, asking nothing, and cancels the next run', async () => {
    await data('/demo/settings/data?state=rt_on');
    pick('Off');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: /^Next run/u })).toBeNull();
    expect(screen.getByText('Turned off. The next run is cancelled.')).toBeDefined();
  });

  it('refuses to hold on a blank reason, says so beside the field, and holds on a real one', async () => {
    await data('/demo/settings/data?state=rt_on');
    fireEvent.click(screen.getByRole('button', { name: 'Hold back Adunni & Femi’s wedding' }));
    const dialog = screen.getByRole('dialog', { name: 'Hold back?' });
    const field = within(dialog).getByLabelText('Reason');

    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hold back' }));

    expect(
      within(dialog).getByText('Enter a reason. Nothing is held back without one.'),
    ).toBeDefined();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field);
    expect(screen.queryByRole('heading', { level: 2, name: 'Held back' })).toBeNull();

    fireEvent.change(field, { target: { value: 'A dispute' } });
    expect(
      within(dialog).queryByText('Enter a reason. Nothing is held back without one.'),
    ).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hold back' }));

    expect(within(block('Held back')).getByText('Adunni & Femi’s wedding')).toBeDefined();
    expect(within(block('Held back')).getByText('Reason: A dispute')).toBeDefined();
    expect(within(block('Held back')).getByText(/^Held by Folake Adeyemi · /u)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Hold back Adunni & Femi’s wedding' })).toBeNull();
    expect(screen.getByText(/^Held back\. Adunni & Femi’s wedding stays out/u)).toBeDefined();
  });

  it('asks before discarding a typed reason, and not a blank one', async () => {
    await data('/demo/settings/data?state=rt_hold');
    const dialog = screen.getByRole('dialog', { name: 'Hold back?' });

    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'A claim' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('alertdialog', { name: 'Discard your reason?' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the blank refusal already pressed', async () => {
    await data('/demo/settings/data?state=rt_hold_blank');

    expect(screen.getByText('Enter a reason. Nothing is held back without one.')).toBeDefined();
  });

  it('lists a held event with who, when and why, and releases it into the next notice', async () => {
    await data('/demo/settings/data?state=rt_held');
    const held = block('Held back');

    expect(within(held).getByText('Tola & Seun’s wedding')).toBeDefined();
    expect(
      within(held).getByText(/^Held by Julien Moreau · Friday, Oct 16 at 11:05 WAT$/u),
    ).toBeDefined();
    expect(within(held).getByText('Reason: The caterer’s claim is still open.')).toBeDefined();

    fireEvent.click(within(held).getByRole('button', { name: 'Release Tola & Seun’s wedding' }));

    expect(screen.queryByRole('heading', { level: 2, name: 'Held back' })).toBeNull();
    expect(
      screen.getByText(/^Released\. Tola & Seun’s wedding is named in the next notice/u),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Hold back Lumen Studio launch' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Hold back Tola & Seun’s wedding' })).toBeNull();
  });

  it('gives an admin the period read only, and Hold back and Release working, in their own zone', async () => {
    await data('/demo/settings/data?state=not_owner');

    expect(
      screen.queryByRole('button', { name: /^Delete guest data after an event: /u }),
    ).toBeNull();
    expect(screen.getByText('Only an Owner can change this.')).toBeDefined();
    expect(block(/^Next run · .* at 14:20 BST$/u)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Release Tola & Seun’s wedding' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hold back Lumen Studio launch' }));
    const dialog = screen.getByRole('dialog', { name: 'Hold back?' });
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'A claim' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hold back' }));

    expect(within(block('Held back')).getByText(/^Held by Julien Moreau · /u)).toBeDefined();
  });

  it('shows it locked off Enterprise, to an owner and an admin alike, with no way to change it', async () => {
    await data('/demo/settings/data?state=rt_locked&as=julien');

    expect(screen.getByText('Available on Enterprise')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Contact Soirely about Enterprise' })).toBeDefined();
    expect(screen.getByText('Locked')).toBeDefined();
    expect(
      screen.queryByRole('button', { name: /^Delete guest data after an event: /u }),
    ).toBeNull();
  });

  it('says a run with no events sends no notice', async () => {
    await data('/demo/settings/data?state=rt_on_empty');

    expect(screen.getByText('No event is in this run.')).toBeDefined();
    expect(screen.getByText('It sends no notice and erases nothing.')).toBeDefined();
  });

  it('writes labelled UTC for an account with no zone', async () => {
    await data('/demo/settings/data?state=rt_on_utc');

    expect(block(/^Next run · .* at 13:20 UTC$/u)).toBeDefined();
  });

  it('turns a refusal into the question’s own alert, with the verb off', async () => {
    await data('/demo/settings/data?state=rt_refused_owner');

    expect(screen.getByRole('alert').textContent).toContain('Only an Owner can change this.');
    expect(screen.getByRole('button', { name: 'Turn on' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('loads, and fails with a way to try again', async () => {
    await data('/demo/settings/data?state=loading');
    expect(screen.getByRole('status', { name: 'Loading guest data settings…' })).toBeDefined();
  });

  it('retries from a failed load', async () => {
    await data('/demo/settings/data?state=failed');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(
      () => expect(screen.getByText('Guests’ details are kept after an event')).toBeDefined(),
      {
        timeout: 3000,
      },
    );
  });
});
