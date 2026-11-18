import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { atPhoneWidth } from '../test-widths.ts';

const tested = config();

function open(at: string) {
  const router = createMemoryRouter(routes, { initialEntries: [at] });
  render(<RouterProvider router={router} />);

  return router;
}

const enquiry = (state: string) => open(`/demo/enquiries/enq-bisi-event?state=${state}`);
const filled = (state: string) => open(`/demo/events/new?from=enquiry&state=${state}`);

function inOrder(first: Element, second: Element): boolean {
  return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

describe('the enquiry’s page as it becomes an event (sc-31232)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => vi.restoreAllMocks());

  it('offers an Owner Create event after Close as lost… in the head, opening New event filled in', async () => {
    enquiry('open-admin');

    const title = await screen.findByRole('heading', { level: 1, name: 'Bisi Adebayo' });
    const close = screen.getByRole('button', { name: 'Close as lost…' });
    const create = screen.getByRole('link', { name: 'Create event' });

    expect(screen.getByText('Open')).toBeDefined();
    expect(inOrder(close, create)).toBe(true);
    expect(close.closest('.enq-made-head')).toBe(title.closest('.enq-made-head'));
    expect(create.getAttribute('href')).toBe('/demo/events/new?from=enquiry&state=filled');
    expect(
      screen.getByText(
        'The rest of the page (Reach them, About the event, Assigned to, Notes) is sc-31226’s.',
      ),
    ).toBeDefined();
  });

  it('puts Create event under the head at a phone’s width, and Close as lost… at the foot', async () => {
    atPhoneWidth();
    enquiry('open-admin');

    const title = await screen.findByRole('heading', { level: 1, name: 'Bisi Adebayo' });
    const create = screen.getByRole('link', { name: 'Create event' });
    const close = screen.getByRole('button', { name: 'Close as lost…' });
    const rest = screen.getByText(/The rest of the page/);

    expect(create.closest('.enq-made-head')).toBeNull();
    expect(inOrder(title, create)).toBe(true);
    expect(inOrder(create, rest)).toBe(true);
    expect(inOrder(rest, close)).toBe(true);
  });

  it('tells the assigned Member an owner or admin creates the event, in its place', async () => {
    enquiry('open-member');

    await screen.findByRole('heading', { level: 1, name: 'Bisi Adebayo' });
    expect(screen.queryByRole('link', { name: 'Create event' })).toBeNull();
    expect(
      screen.getByText('An owner or admin creates the event from this enquiry.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Close as lost…' })).toBeDefined();
  });

  it('says what a Won enquiry became, with nothing to reopen, close or create', async () => {
    enquiry('won');

    const card = await screen.findByRole('region', { name: 'Won' });
    const became = within(card).getByRole('link', { name: 'Became Bisi Adebayo · Anniversary' });

    expect(became.getAttribute('href')).toBe('/demo/events/evt-draft-4?state=from-enquiry');
    expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close as lost…' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Create event' })).toBeNull();
  });

  it('keeps a stale Reopen Won, and the demo replays it', async () => {
    enquiry('won-has-event');

    const notice = 'Not reopened. This enquiry became an event meanwhile, so it stays Won.';
    expect(await screen.findByText(notice)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Press Reopen on the stale page' }));

    expect(screen.queryByText(notice)).toBeNull();
    expect(screen.getByRole('region', { name: 'Lost · Budget' })).toBeDefined();
    const reopen = screen.getByRole('button', { name: 'Reopen' });
    expect(document.activeElement).toBe(reopen);
    fireEvent.click(reopen);

    expect(screen.getByText(notice)).toBeDefined();
    expect(screen.getByRole('region', { name: 'Won' })).toBeDefined();
  });

  it('offers Create event again once its event was deleted', async () => {
    enquiry('event-deleted');

    expect(await screen.findByText('The event made from this enquiry was deleted.')).toBeDefined();
    expect(screen.getByText('Open')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Create event' })).toBeDefined();
  });

  it('leaves another enquiry’s placeholder as it was', async () => {
    open('/demo/enquiries/enq-ada?state=won');

    expect(await screen.findByRole('heading', { level: 1, name: 'Ada Okafor' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Won' })).toBeNull();
  });
});

describe('New event filled in from an enquiry (sc-31232)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => vi.useRealTimers());

  it('fills the fields from Bisi Adebayo’s enquiry, says so first, and names the Lead', async () => {
    filled('filled');

    const name = await screen.findByRole('textbox', { name: /Event name/ });
    const form = name.closest('form') as HTMLElement;
    const headings = within(form)
      .getAllByRole('heading', { level: 2 })
      .map((one) => one.textContent);

    expect((name as HTMLInputElement).value).toBe('Bisi Adebayo · Anniversary');
    expect(form.firstElementChild?.textContent).toContain(
      'Filled in from Bisi Adebayo’s enquiry. Check each field before you create the event.',
    );
    expect(headings.slice(0, 3)).toEqual(['About the event', 'Hosted by', 'Lead']);
    const lead = screen.getByRole('group', { name: 'Lead: Tunde Bakare' });
    expect(
      within(lead).getByText('They get the event role Lead when you create the event.'),
    ).toBeDefined();
    expect(screen.getByText('From the budget in the enquiry.')).toBeDefined();
    expect(screen.queryByText('Filled in from Ire Events’s settings.')).toBeNull();
  });

  it('changes the Lead from the Members, removes it, and chooses one again', async () => {
    filled('lead-member');

    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    const members = screen.getByRole('combobox', { name: 'Members' });
    expect(document.activeElement).toBe(members);
    fireEvent.change(members, { target: { value: 'Chidi Nnamdi' } });
    expect(screen.getByRole('group', { name: 'Lead: Chidi Nnamdi' })).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    const none = screen.getByRole('group', { name: 'Lead: No lead' });
    expect(
      within(none).getByText('Chidi Nnamdi won’t be given a role on this event.'),
    ).toBeDefined();
    const choose = within(none).getByRole('button', { name: 'Choose a lead' });
    expect(document.activeElement).toBe(choose);

    fireEvent.click(choose);
    fireEvent.change(screen.getByRole('combobox', { name: 'Members' }), {
      target: { value: 'Amaka Obi' },
    });
    expect(screen.getByRole('group', { name: 'Lead: Amaka Obi' })).toBeDefined();
  });

  it('opens with the Lead removed', async () => {
    filled('lead-removed');

    expect(await screen.findByRole('group', { name: 'Lead: No lead' })).toBeDefined();
    expect(screen.getByText('Tunde Bakare won’t be given a role on this event.')).toBeDefined();
  });

  it('draws no Lead for an Admin’s enquiry, and the organisation’s currency for one not offered', async () => {
    filled('lead-none');

    expect(await screen.findByRole('textbox', { name: /Event name/ })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Lead' })).toBeNull();
    expect((screen.getByRole('combobox', { name: 'Currency' }) as HTMLSelectElement).value).toBe(
      'EUR',
    );
  });

  it('falls back to NGN with New event’s own help when JPY is not offered', async () => {
    filled('currency-not-offered');

    await screen.findByRole('textbox', { name: /Event name/ });
    expect((screen.getByRole('combobox', { name: 'Currency' }) as HTMLSelectElement).value).toBe(
      'NGN',
    );
    expect(screen.getByText('Filled in from Ire Events’s settings.')).toBeDefined();
  });

  it('cuts a long enquiry, counting the name at 120 of 120', async () => {
    filled('long');

    const name = (await screen.findByRole('textbox', { name: /Event name/ })) as HTMLInputElement;
    expect(name.value.endsWith(' · Religious celebra')).toBe(true);
    expect(screen.getByText(/120\/120|120 of 120/)).toBeDefined();
  });

  it('refuses the empty times with New event’s own words, focusing Starts', async () => {
    filled('refused');

    expect(await screen.findByText('2 fields need fixing, so nothing was sent.')).toBeDefined();
    expect(screen.getByText('Choose when the event starts.')).toBeDefined();
    expect(screen.getByText('Choose when the event ends.')).toBeDefined();
    expect((document.activeElement as HTMLElement).closest('fieldset')?.textContent).toContain(
      'Starts',
    );
  });

  it('answers Create with the 409 and the 403, keeping what was typed', async () => {
    filled('not-open');

    const closed =
      'Not created. This enquiry was closed while you were filling this in, so no event was made from it.';
    expect(await screen.findByText(closed)).toBeDefined();
    const name = screen.getByRole('textbox', { name: /Event name/ });
    fireEvent.change(name, { target: { value: 'Bisi’s 25th' } });
    expect(screen.queryByText(closed)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    expect(screen.getByText(closed)).toBeDefined();
    expect((name as HTMLInputElement).value).toBe('Bisi’s 25th');
  });

  it('says only an owner or admin may create it', async () => {
    filled('forbidden');

    expect(
      await screen.findByText(
        'Not created. Only an owner or admin can create an event from an enquiry.',
      ),
    ).toBeDefined();
  });

  it('creates once the times are chosen and opens the draft from the enquiry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const router = filled('filled');

    await screen.findByRole('textbox', { name: /Event name/ });
    const [startTime, endTime] = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="time"]'),
    );
    fireEvent.change(startTime as HTMLInputElement, { target: { value: '14:00' } });
    fireEvent.change(endTime as HTMLInputElement, { target: { value: '22:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDefined();
    await act(async () => vi.advanceTimersByTimeAsync(1300));
    expect(screen.getByText('Created. Opening the event.')).toBeDefined();
    await act(async () => vi.advanceTimersByTimeAsync(1700));
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
      '/demo/events/evt-draft-4?state=from-enquiry',
    );
  });

  it('leaves New event as it was with no enquiry', async () => {
    open('/demo/events/new?state=filled');

    await screen.findByRole('textbox', { name: /Event name/ });
    expect(screen.queryByText(/Filled in from .*enquiry/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Lead' })).toBeNull();
  });
});

describe('the event made from an enquiry (sc-31232)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('links back to the enquiry from the Overview’s Details', async () => {
    open('/demo/events/evt-draft-4?state=from-enquiry');

    const from = await screen.findByRole('link', { name: 'From an enquiry · Bisi Adebayo' });
    expect(from.getAttribute('href')).toBe('/demo/enquiries/enq-bisi-event?state=won');
    expect(screen.getAllByText('Bisi Adebayo · Anniversary').length).toBeGreaterThan(0);
  });

  it.each(['from-enquiry-hidden', 'free-plan'])('draws no line for %s', async (state) => {
    open(`/demo/events/evt-draft-4?state=${state}`);

    expect((await screen.findAllByText('Bisi Adebayo · Anniversary')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /From an enquiry/ })).toBeNull();
  });

  it('leaves the draft as it was with no state', async () => {
    open('/demo/events/evt-draft-4');

    expect((await screen.findAllByText('Bisi & Kola’s engagement')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /From an enquiry/ })).toBeNull();
  });
});
