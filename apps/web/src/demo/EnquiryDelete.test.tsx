import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

describe('an erased enquiry (sc-31235)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('shows on Lost first, titled by what is kept, with the Erased mark', async () => {
    open('/demo/enquiries?state=lost-with-erased');

    const rows = await screen.findAllByRole('link', { name: /enquiry|Okafor|Umeh/ });
    const first = rows.find((row) => row.textContent?.includes('Erased enquiry'));

    expect(first?.textContent).toContain('Erased enquiry · Wedding · June 2027');
    expect(first?.textContent).toContain('Erased');
    expect(screen.queryByText(/No date yet/)).toBeNull();
  });

  it('reads only what is kept on its page, with no way to reach the client and no notes', async () => {
    open('/demo/enquiries/enq-erased?state=erased-page');

    expect(await screen.findByRole('heading', { level: 1, name: 'Erased enquiry' })).toBeDefined();
    expect(
      screen.getByText(
        'The client’s details were erased on Nov 12, 2026, 12 months after this enquiry last changed.',
      ),
    ).toBeDefined();
    expect(screen.getByText('June 2027')).toBeDefined();
    expect(screen.getByRole('region', { name: 'Dates' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Reach them' })).toBeNull();
    expect(screen.queryByText(/Notes/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete enquiry…' })).toBeDefined();
  });

  it('keeps its consultations without a place or a link', async () => {
    open('/demo/enquiries/enq-erased?state=erased-with-consultations');

    const card = await screen.findByRole('region', { name: 'Consultations' });

    expect(within(card).getAllByText(/Led by/)).toHaveLength(2);
    expect(within(card).queryByRole('link')).toBeNull();
  });
});

describe('the 30-day warning (sc-31235)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('is on the Open row', async () => {
    open('/demo/enquiries?state=warning-row');

    expect(
      await screen.findByText(
        'This enquiry’s details will be erased on Dec 4, 2026 unless it changes.',
      ),
    ).toBeDefined();
  });

  it('is not on a row with a consultation to come', async () => {
    open('/demo/enquiries?state=open-consultation-ahead');

    await screen.findAllByRole('link', { name: /Yemi Coker/ });
    expect(screen.queryByText(/will be erased/)).toBeNull();
  });

  it('is a note on the page, and Open stays the status', async () => {
    open('/demo/enquiries/enq-quiet?state=warning-member');

    expect((await screen.findByRole('note', { name: '' })).textContent).toContain('will be erased');
    expect(screen.getByText('Open')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Delete enquiry…' })).toBeNull();
  });
});

describe('Delete enquiry (sc-31235)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it('asks first, then lands back on the list it came from with Enquiry deleted.', async () => {
    const router = open('/demo/enquiries?state=lost-with-erased');

    const row = (await screen.findAllByRole('link')).find((one) =>
      one.textContent?.includes('Erased enquiry · Wedding'),
    )!;
    fireEvent.click(row);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete enquiry…' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Delete this enquiry?' });
    expect(dialog.textContent).toContain(
      'This erased enquiry and its consultations will be deleted for good.',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(within(dialog).getByRole('button', { name: 'Deleting…' })).toBeDefined();
    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(router.state.location.search).toBe('?state=lost-with-erased');
    expect(await screen.findByText('Enquiry deleted.')).toBeDefined();
    expect(screen.queryByText(/Erased enquiry · Wedding/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Undo/ })).toBeNull();
  });

  it('names the client in the confirm', async () => {
    open('/demo/enquiries/enq-ada?state=delete-confirm');

    expect((await screen.findByRole('alertdialog')).textContent).toContain(
      'Ada Okafor’s details, notes and consultations will be deleted for good.',
    );
  });

  it('says why it failed and offers Try again', async () => {
    open('/demo/enquiries/enq-ada?state=delete-failed');

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('alert').textContent).toContain(
      'Not deleted. Nothing was changed. Try again.',
    );
    expect(within(dialog).getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('opened from a link, lands on Enquiries, Open', async () => {
    const router = open('/demo/enquiries/enq-ada?state=delete-confirm');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(router.state.location.pathname).toBe('/demo/enquiries');
    expect(await screen.findByText('Enquiry deleted.')).toBeDefined();
    expect(screen.getByRole('tab', { name: /Open/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('is not offered to a Member', async () => {
    open('/demo/enquiries/enq-femi?state=member-no-delete');

    await screen.findByRole('heading', { level: 1, name: 'Femi Okanlawon' });
    expect(screen.queryByRole('button', { name: 'Delete enquiry…' })).toBeNull();
  });

  it('tells an Owner to delete a Won enquiry’s event first, and a Member nothing', async () => {
    open('/demo/enquiries/enq-bisi?state=won-owner');

    expect(
      await screen.findByText(/To delete this enquiry, delete its event first./),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Bisi Adebayo · Anniversary' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Delete enquiry…' })).toBeNull();
  });

  it('shows only Close when it went Won while the confirm was open', async () => {
    open('/demo/enquiries/enq-bisi?state=won-race-409');

    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this enquiry?' });
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['Close']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('Won')).toBeDefined();
  });

  it('on the Calendar, its consultations are gone', async () => {
    open('/demo/consultations?state=deleted-from-calendar');

    expect(await screen.findByText('Enquiry deleted.')).toBeDefined();
    expect(screen.queryByText(/Lucía Fernández/)).toBeNull();
    expect(screen.getAllByText('Nothing on this day.')).toHaveLength(2);
  });
});
