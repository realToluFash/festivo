import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

describe('New enquiry checks before it sends (sc-31226)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('opens from the list’s New enquiry', async () => {
    open('/demo/enquiries');

    const links = await screen.findAllByRole('link', { name: /New enquiry/ });

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute('href')).toBe('/demo/enquiries/new');
  });

  it('keeps Save enabled, sends nothing blank, says why on each field and moves focus to the first', async () => {
    const router = open('/demo/enquiries/new');

    const save = await screen.findByRole('button', { name: 'Save enquiry' });
    expect(save.hasAttribute('disabled')).toBe(false);
    fireEvent.click(save);

    const name = screen.getByLabelText('Client’s name');
    expect(document.activeElement).toBe(name);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    const said = document.getElementById(name.getAttribute('aria-describedby')!.split(' ')[0]!);
    expect(said?.textContent).toContain('Enter the client’s name.');
    expect(screen.getByText('Add a phone or an email, so you can reach the client.')).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/enquiries/new');

    fireEvent.change(name, { target: { value: 'Ama Mensah' } });
    expect(screen.queryByText('Enter the client’s name.')).toBeNull();
    expect(name.getAttribute('aria-invalid')).toBe('false');
  });

  it('refuses a number that is not one, without saying mobile', async () => {
    open('/demo/enquiries/new?state=invalidPhone');

    expect(
      await screen.findByText(
        'That is not a phone number for the United Kingdom. Check it and try again.',
      ),
    ).toBeDefined();
    expect(screen.getByLabelText('Phone').getAttribute('aria-invalid')).toBe('true');
  });

  it.each([
    [
      'phoneTooShort',
      'That number looks too short for the United Kingdom. Check it and try again.',
    ],
    ['phoneTooLong', 'That number looks too long for the United Kingdom. Check it and try again.'],
  ])('%s keeps the account’s words', async (state, words) => {
    open(`/demo/enquiries/new?state=${state}`);

    expect(await screen.findByText(words)).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Phone'));
  });

  it('saves a fixed line and opens the new enquiry', async () => {
    const router = open('/demo/enquiries/new?state=fixedLine');

    fireEvent.click(await screen.findByRole('button', { name: 'Save enquiry' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ama Mensah' }, { timeout: 3000 }),
    ).toBeDefined();
    expect(router.state.location.pathname).toMatch(/^\/demo\/enquiries\/enq-new-/u);
    expect(screen.getByText('Enquiry saved.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Call +44 20 7946 0018' })).toBeDefined();
  });

  it('tells an Owner who has the same client, with Open it', async () => {
    open('/demo/enquiries/new?state=duplicateAdmin');

    expect(
      await screen.findByText(
        'There’s already an open enquiry from this number: Ada Okafor, assigned to Folake Adeyemi',
      ),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Open it' }).getAttribute('href')).toBe(
      '/demo/enquiries/enq-ada',
    );
  });

  it('tells a Member only that one exists', async () => {
    open('/demo/enquiries/new?state=duplicateMember');

    expect(
      await screen.findByText(
        'There’s already an open enquiry with this number. An owner or admin can see it.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Open it' })).toBeNull();
    expect(screen.queryByLabelText('Assigned to')).toBeNull();
  });
});

describe('Close as lost (sc-31226)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('asks why before it closes, then shows Lost with Reopen', async () => {
    open('/demo/enquiries/enq-ada?state=open');

    fireEvent.click(await screen.findByRole('button', { name: 'Close as lost…' }));
    const panel = screen.getByRole('complementary', { name: 'Close as lost' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Close as lost' }));

    expect(within(panel).getByText('Choose why it was lost.')).toBeDefined();
    expect(document.activeElement).toBe(
      within(panel).getByRole('radio', { name: 'Chose someone else' }),
    );

    fireEvent.click(within(panel).getByRole('radio', { name: 'Budget' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Close as lost' }));

    expect(await screen.findByText('Closed as lost.')).toBeDefined();
    expect(screen.getAllByText('Lost · Budget').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(await screen.findByText('Reopened. It is back on Open.')).toBeDefined();
    expect(screen.getByText('Open')).toBeDefined();
  });

  it('refuses a line over 200 characters and keeps the reason, the line and Open', async () => {
    open('/demo/enquiries/enq-ada?state=closeAsLostTooLong');

    const panel = await screen.findByRole('complementary', { name: 'Close as lost' });
    const line = within(panel).getByLabelText(/Anything to add/u) as HTMLInputElement;

    expect(within(panel).getByText('Keep it to 200 characters.')).toBeDefined();
    expect(line.value).toHaveLength(201);
    expect(line.getAttribute('aria-invalid')).toBe('true');
    expect(
      (within(panel).getByRole('radio', { name: 'Chose someone else' }) as HTMLInputElement)
        .checked,
    ).toBe(true);

    fireEvent.click(within(panel).getByRole('button', { name: 'Close as lost' }));

    expect(screen.queryByText('Closed as lost.')).toBeNull();
    expect(screen.getByText('Open')).toBeDefined();
    expect(line.value).toHaveLength(201);
  });

  it('saves no line for a line of only spaces', async () => {
    open('/demo/enquiries/enq-ada?state=closeAsLost');

    const panel = await screen.findByRole('complementary', { name: 'Close as lost' });
    fireEvent.click(within(panel).getByRole('radio', { name: 'Chose someone else' }));
    fireEvent.change(within(panel).getByLabelText(/Anything to add/u), {
      target: { value: '    ' },
    });
    fireEvent.click(within(panel).getByRole('button', { name: 'Close as lost' }));

    const banner = await screen.findByRole('note');
    expect(within(banner).getByText('Lost · Chose someone else')).toBeDefined();
    expect(banner.querySelector('.desk-line')).toBeNull();
  });

  it('shows Ngozi lost with no line (lostNoLine)', async () => {
    open('/demo/enquiries/enq-ngozi?state=lostNoLine');

    const banner = await screen.findByRole('note');
    expect(within(banner).getByText('Lost · Chose someone else')).toBeDefined();
    expect(banner.querySelector('.desk-line')).toBeNull();
    expect(within(banner).getByRole('button', { name: 'Reopen' })).toBeDefined();
  });
});

describe('An enquiry’s page (sc-31226)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('tells a Member an enquiry assigned to someone else is not here', async () => {
    open('/demo/enquiries/enq-ada?state=notFound');

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'This enquiry isn’t here',
    });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole('link', { name: 'Back to Enquiries' }).getAttribute('href')).toBe(
      '/demo/enquiries',
    );
  });

  it('returns to the same search after opening a result', async () => {
    open('/demo/enquiries');

    const search = await screen.findByRole('searchbox');
    fireEvent.change(search, { target: { value: 'Ada' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.click((await screen.findAllByRole('link', { name: /Ada Okafor/u }))[0]!);

    await screen.findByRole('heading', { level: 1, name: 'Ada Okafor' });
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    fireEvent.click(within(crumb).getByRole('link', { name: 'Enquiries' }));

    expect(((await screen.findByRole('searchbox')) as HTMLInputElement).value).toBe('Ada');
  });

  it('opens Edit filled, with Save changes and no What they have in mind', async () => {
    const router = open('/demo/enquiries/enq-ada?state=open');

    fireEvent.click(await screen.findByRole('link', { name: 'Edit' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Edit enquiry' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/enquiries/enq-ada/edit');
    expect((screen.getByLabelText('Client’s name') as HTMLInputElement).value).toBe('Ada Okafor');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDefined();
    expect(screen.queryByLabelText(/What they have in mind/u)).toBeNull();
  });

  it('adds a note at the top', async () => {
    open('/demo/enquiries/enq-ada?state=open');

    fireEvent.click(await screen.findByRole('button', { name: 'Add note' }));
    expect(screen.getByText('Write the note first.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Add a note'), {
      target: { value: 'Sent the brochure.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));

    const notes = screen
      .getAllByRole('listitem')
      .filter((one) => one.classList.contains('enq-note'));
    expect(notes[0]?.textContent).toContain('Sent the brochure.');
  });
});

describe('Enquiries in the navigation (sc-31226)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it.each(['/demo/today', '/demo/calendar', '/demo/events', '/demo/menu-library'])(
    'is right after Events on %s for an Enterprise organisation',
    async (path) => {
      open(path);
      const places = await screen.findAllByRole('link', { name: /^(Events|Enquiries)$/ });
      expect(places.map((one) => one.textContent)).toEqual(['Events', 'Enquiries']);
    },
  );

  it.each(['/demo/today?plan=free', '/demo/events?plan=free', '/demo/consultations?state=freeOrg'])(
    'is not there on %s for a Free organisation',
    async (path) => {
      open(path);
      await screen.findAllByRole('link', { name: 'Events' });
      expect(screen.queryByRole('link', { name: 'Enquiries' })).toBeNull();
    },
  );
});
