import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };
const TITLE = 'Delete guest data after an event';
const AT = '/demo/settings/data-and-control/delete-guest-data';

async function data(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: TITLE }, FIRST_LOAD);
}

function block(name: string | RegExp): HTMLElement {
  return screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
}

function pick(period: string) {
  fireEvent.click(screen.getByRole('button', { name: /^Delete guest data after an event: / }));
  fireEvent.click(screen.getByRole('menuitemradio', { name: period }));
}

describe('Data and control › Delete guest data after an event at a desk (sc-30194)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('opens from Data and control, one level down, with the way back', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/settings'] });
    render(<RouterProvider router={router} />);
    const list = await screen.findByRole('navigation', { name: 'Settings' }, FIRST_LOAD);

    fireEvent.click(within(list).getByRole('link', { name: 'Data and control' }));
    fireEvent.click(
      await screen.findByRole('link', { name: /^Delete guest data after an event/u }),
    );

    expect(await screen.findByRole('heading', { level: 1, name: TITLE })).toBeDefined();
    expect(router.state.location.pathname).toBe(AT);
    expect(
      within(list).getByRole('link', { name: 'Data and control' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(screen.getByRole('heading', { level: 2, name: 'How long' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Data and control' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Data and control' }),
    ).toBeDefined();
  });

  it('takes the old address there, its query kept', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/demo/settings/data?state=rt_on&as=julien'],
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1, name: TITLE }, FIRST_LOAD);

    expect(router.state.location.pathname).toBe(AT);
    expect(router.state.location.search).toBe('?state=rt_on&as=julien');
    expect(screen.getByText('Only an owner can change this.')).toBeDefined();
  });

  it('gives a member nothing at its address', async () => {
    const router = createMemoryRouter(routes, { initialEntries: [`${AT}?as=ana`] });
    render(<RouterProvider router={router} />);
    const list = await screen.findByRole('navigation', { name: 'Settings' }, FIRST_LOAD);

    expect(within(list).queryByRole('link', { name: 'Data and control' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: TITLE })).toBeNull();
  });

  it('is Off by default and offers exactly the five periods', async () => {
    await data(AT);

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
    await data(AT);
    pick('90 days');
    const dialog = screen.getByRole('dialog', { name: 'Delete guest data?' });

    expect(
      within(dialog).getByText(
        /^2 events will have ended at least 90 days before the first run, on .* at 14:20 WAT, so their guests are in it\.$/u,
      ),
    ).toBeDefined();
    expect(within(dialog).getByText('Owners and admins are emailed now.')).toBeDefined();
    expect(within(dialog).getByText('Erased details can’t come back.')).toBeDefined();
    expect(within(dialog).getByText('Adunni & Femi’s wedding')).toBeDefined();

    fireEvent.click(within(dialog).getByRole('radio', { name: '180 days' }));
    expect(
      within(dialog).getByText(/^1 event will have ended .* so its guests are in it\.$/u),
    ).toBeDefined();

    fireEvent.click(within(dialog).getByRole('radio', { name: '365 days' }));
    expect(
      within(dialog).getByText(/^No event will have ended .* so it erases nothing yet\.$/u),
    ).toBeDefined();
    expect(
      within(dialog).getByText(
        'Owners and admins are emailed 7 days before any run with events in it.',
      ),
    ).toBeDefined();
    expect(within(dialog).queryByText('Owners and admins are emailed now.')).toBeNull();
    expect(within(dialog).queryByRole('radio', { name: 'Off' })).toBeNull();
  });

  it('changes nothing until the verb, and shows the run once turned on', async () => {
    await data(AT);
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
    await data(`${AT}?state=rt_on`);
    pick('Off');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: /^Next run/u })).toBeNull();
    expect(screen.getByText('Turned off. The next run is cancelled.')).toBeDefined();
  });

  it('refuses to hold on a blank reason, says so beside the field, and holds on a real one', async () => {
    await data(`${AT}?state=rt_on`);
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

  it('refuses a reason over 500 characters beside the field, cuts nothing, and holds 500 with spaces around', async () => {
    await data(`${AT}?state=rt_on`);
    fireEvent.click(screen.getByRole('button', { name: 'Hold back Adunni & Femi’s wedding' }));
    const dialog = screen.getByRole('dialog', { name: 'Hold back?' });
    const field = within(dialog).getByLabelText('Reason') as HTMLInputElement;
    const long = 'x'.repeat(501);

    fireEvent.change(field, { target: { value: long } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hold back' }));

    expect(
      within(dialog).getByText('Shorten the reason to 500 characters or fewer.'),
    ).toBeDefined();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.value).toBe(long);
    expect(field.getAttribute('maxlength')).toBeNull();
    expect(document.activeElement).toBe(field);
    expect(screen.queryByRole('heading', { level: 2, name: 'Held back' })).toBeNull();

    fireEvent.change(field, { target: { value: `  ${'x'.repeat(500)}  ` } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hold back' }));

    expect(within(block('Held back')).getByText(`Reason: ${'x'.repeat(500)}`)).toBeDefined();
  });

  it('opens a pasted reason past the limit whole, refused, and says the limit before it', async () => {
    await data(`${AT}?state=rt_hold_long`);
    const dialog = screen.getByRole('dialog', { name: 'Hold back?' });
    const field = within(dialog).getByLabelText('Reason') as HTMLInputElement;

    expect(field.value).toMatch(/Ask Folake before anyone releases it\.$/u);
    expect(
      within(dialog).getByText('Shorten the reason to 500 characters or fewer.'),
    ).toBeDefined();
    expect(
      within(dialog).getByText(
        'Owners and admins see who held it, when and why. Up to 500 characters.',
      ),
    ).toBeDefined();
  });

  it('shows a long reason in full in the held list', async () => {
    await data(`${AT}?state=rt_held_long`);

    expect(
      within(block('Held back')).getByText(/^Reason: Mesa Viva .* until both are closed\.$/u),
    ).toBeDefined();
  });

  it('keeps a hold through Off with Release, and counts it once released and on again', async () => {
    await data(`${AT}?state=rt_off_held`);

    expect(screen.getByRole('button', { name: /event: Off$/u })).toBeDefined();
    expect(screen.queryByRole('heading', { level: 2, name: /^Next run/u })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Hold back /u })).toBeNull();
    fireEvent.click(
      within(block('Held back')).getByRole('button', { name: 'Release Tola & Seun’s wedding' }),
    );

    expect(
      screen.getByText('Released. Tola & Seun’s wedding is no longer held back.'),
    ).toBeDefined();
    expect(screen.queryByRole('heading', { level: 2, name: 'Held back' })).toBeNull();
    pick('90 days');
    expect(
      within(screen.getByRole('dialog', { name: 'Delete guest data?' })).getByText(
        /^3 events will have ended at least 90 days/u,
      ),
    ).toBeDefined();
  });

  it('opens Off released from its own link', async () => {
    await data(`${AT}?state=rt_off_released`);

    expect(
      screen.getByText('Released. Tola & Seun’s wedding is no longer held back.'),
    ).toBeDefined();
  });

  it.each([
    ['an owner', ''],
    ['an admin', '&as=julien'],
  ])(
    'shows an organisation that left Enterprise its kept period and holds, read only, to %s',
    async (_who, as) => {
      await data(`${AT}?state=rt_downgraded${as}`);

      expect(
        screen.getByText(
          'Switched off on Sunday, Oct 18, when Ire Events left Enterprise. The period and the held events are kept as they were, and retention comes back on with Enterprise.',
        ),
      ).toBeDefined();
      expect(screen.getByText('Locked')).toBeDefined();
      expect(screen.getByText('90 days')).toBeDefined();
      expect(
        screen.getByText('Switched off and kept as it was. It comes back on with Enterprise.'),
      ).toBeDefined();
      expect(
        screen.queryByRole('button', { name: /^Delete guest data after an event: /u }),
      ).toBeNull();
      const held = block('Held back');
      expect(within(held).getByText('Tola & Seun’s wedding')).toBeDefined();
      expect(
        within(held).getByText(/^Held by Julien Moreau · Friday, Oct 16 at 11:05 /u),
      ).toBeDefined();
      expect(within(held).getByText('Reason: The caterer’s claim is still open.')).toBeDefined();
      expect(
        within(held).getByText('Kept as they were, and can be released again on Enterprise.'),
      ).toBeDefined();
      expect(within(held).queryByRole('button')).toBeNull();
      expect(screen.queryByRole('heading', { level: 2, name: /^Next run/u })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Hold back /u })).toBeNull();
      expect(
        screen.getByRole('button', { name: 'Contact Soirely about Enterprise' }),
      ).toBeDefined();
    },
  );

  it('asks before discarding a typed reason, and not a blank one', async () => {
    await data(`${AT}?state=rt_hold`);
    const dialog = screen.getByRole('dialog', { name: 'Hold back?' });

    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'A claim' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('alertdialog', { name: 'Discard your reason?' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the blank refusal already pressed', async () => {
    await data(`${AT}?state=rt_hold_blank`);

    expect(screen.getByText('Enter a reason. Nothing is held back without one.')).toBeDefined();
  });

  it('lists a held event with who, when and why, and releases it into the next notice', async () => {
    await data(`${AT}?state=rt_held`);
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
    await data(`${AT}?state=not_owner`);

    expect(
      screen.queryByRole('button', { name: /^Delete guest data after an event: /u }),
    ).toBeNull();
    expect(screen.getByText('Only an owner can change this.')).toBeDefined();
    expect(block(/^Next run · .* at 14:20 BST$/u)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Release Tola & Seun’s wedding' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hold back Lumen Studio launch' }));
    const dialog = screen.getByRole('dialog', { name: 'Hold back?' });
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'A claim' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hold back' }));

    expect(within(block('Held back')).getByText(/^Held by Julien Moreau · /u)).toBeDefined();
  });

  it('shows it locked to an organisation never on Enterprise, to an owner and an admin alike, with nothing kept', async () => {
    await data(`${AT}?state=rt_locked&as=julien`);

    expect(screen.queryByRole('heading', { level: 2, name: 'Held back' })).toBeNull();

    expect(screen.getByText('Available on Enterprise')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Contact Soirely about Enterprise' })).toBeDefined();
    expect(screen.getByText('Locked')).toBeDefined();
    expect(
      screen.queryByRole('button', { name: /^Delete guest data after an event: /u }),
    ).toBeNull();
  });

  it('says a run with no events sends no notice', async () => {
    await data(`${AT}?state=rt_on_empty`);

    expect(screen.getByText('No event is in this run.')).toBeDefined();
    expect(screen.getByText('It sends no notice and erases nothing.')).toBeDefined();
  });

  it('writes labelled UTC for an account with no zone', async () => {
    await data(`${AT}?state=rt_on_utc`);

    expect(block(/^Next run · .* at 13:20 UTC$/u)).toBeDefined();
  });

  it('turns a refusal into the question’s own alert, with the verb off', async () => {
    await data(`${AT}?state=rt_refused_owner`);

    expect(screen.getByRole('alert').textContent).toContain('Only an owner can change this.');
    expect(screen.getByRole('button', { name: 'Turn on' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('loads, and fails with a way to try again', async () => {
    await data(`${AT}?state=loading`);
    expect(screen.getByRole('status', { name: 'Loading guest data settings…' })).toBeDefined();
  });

  it('retries from a failed load', async () => {
    await data(`${AT}?state=failed`);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(
      () => expect(screen.getByText('Guests’ details are kept after an event')).toBeDefined(),
      {
        timeout: 3000,
      },
    );
  });
});
