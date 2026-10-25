import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

function signedIn(organisation = IRE): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    needsOrganisation: false,
    hasPassword: true,
    organisation,
    organisations: [organisation],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

function languageField(): HTMLSelectElement {
  const field = document.querySelector<HTMLSelectElement>('select#organisation-locale');

  expect(field?.labels?.length).toBe(1);

  return field as HTMLSelectElement;
}

function readOnlyLanguage(): HTMLElement {
  return screen.getByTestId('organisation-locale');
}

function settings() {
  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/app/settings'] })} />,
  );
}

function answering(answer: (body: unknown) => Response) {
  const sent: { method: string; path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ method: init?.method ?? 'GET', path: new URL(String(input)).pathname, body });

    return answer(body);
  });

  return sent;
}

beforeEach(() => signedIn());

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Settings > General', () => {
  it("shows the six fields with the organisation's values", () => {
    settings();

    expect(screen.getByRole('heading', { level: 1, name: 'General' })).toBeDefined();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Ìrè Events');
    expect((screen.getByLabelText('Country') as HTMLSelectElement).value).toBe('NG');
    expect((screen.getByLabelText('Contact address') as HTMLInputElement).value).toBe(
      'hello@ire.events',
    );
    expect((screen.getByLabelText('Currency') as HTMLSelectElement).value).toBe('NGN');
    expect((screen.getByLabelText('Time zone') as HTMLSelectElement).value).toBe('Africa/Lagos');
    expect(screen.getByText(/new events start with these/)).toBeDefined();
    expect(languageField().value).toBe('en');
  });

  it('offers exactly the four languages, each also in its own words, after the defaults note', () => {
    settings();

    const language = languageField();

    expect([...language.options].map((option) => option.textContent)).toEqual([
      'English',
      'Spanish · Español',
      'French · Français',
      'Portuguese · Português',
    ]);
    expect(language.getAttribute('aria-describedby')).toBe('organisation-locale-help');
    expect(
      language.compareDocumentPosition(
        screen.getByText(/Invitation emails to people without a Soirely account/),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText(/new events start with these/).compareDocumentPosition(language)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('saves a new language on the same PATCH and says invitations already sent stay sent', async () => {
    const sent = answering(
      (body) =>
        new Response(JSON.stringify({ ...IRE, ...(body as object), role: undefined }), {
          status: 200,
        }),
    );
    settings();

    fireEvent.change(languageField(), { target: { value: 'fr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'Saved. Invitation emails to people without a Soirely account go out in French from now on. Invitations already sent are not sent again.',
      ),
    );
    expect(sent.filter((request) => request.method === 'PATCH')).toEqual([
      { method: 'PATCH', path: '/api/orgs/org_1', body: { locale: 'fr' } },
    ]);
  });

  it('turns read-only under the refusal when the role lost the permission while the page was open', async () => {
    const coordinator = membership({
      role: { id: 'role_2', seededAs: 'coordinator', name: null },
      permissions: ['events.read'],
    });
    const refusal = {
      type: 'https://soirely.com/errors/permission_required',
      title: 'This needs the organisation.manage permission.',
      status: 403,
    };
    const sent = answering(() => new Response('{}', { status: 500 }));
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      sent.push({
        method: init?.method ?? 'GET',
        path: new URL(String(input)).pathname,
        body: null,
      });

      return init?.method === 'PATCH'
        ? new Response(JSON.stringify(refusal), { status: 403 })
        : new Response(JSON.stringify({ organisations: [coordinator], requests: [] }), {
            status: 200,
          });
    });
    settings();

    fireEvent.change(languageField(), { target: { value: 'pt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Nothing was saved. Your role does not include the permission this needs.',
    );
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(readOnlyLanguage().textContent).toBe('English');
    await waitFor(() =>
      expect(
        screen.getByText(/Your role, Coordinator, can see these but not change them/),
      ).toBeDefined(),
    );
  });

  it('sends only what changed, and every screen reads the new name at once', async () => {
    const sent = answering(
      (body) =>
        new Response(JSON.stringify({ ...IRE, ...(body as object), role: undefined }), {
          status: 200,
        }),
    );
    settings();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ìrè Events Ltd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/Saved\. Everyone in Ìrè Events Ltd/),
    );
    expect(
      sent.filter((request) => request.path.startsWith('/api/orgs') && request.method !== 'GET'),
    ).toEqual([{ method: 'PATCH', path: '/api/orgs/org_1', body: { name: 'Ìrè Events Ltd' } }]);
    expect(
      screen.getByRole('button', { name: /Organisation: Ìrè Events Ltd, your role Owner/ }),
    ).toBeDefined();
  });

  it('refuses a blank name and a contact that is not an address before sending anything', () => {
    const sent = answering(() => new Response('{}', { status: 500 }));
    settings();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } });
    fireEvent.change(screen.getByLabelText('Contact address'), {
      target: { value: 'hello at ire' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText("Enter the organisation's name.")).toBeDefined();
    expect(screen.getByText(/That does not look like an email address/)).toBeDefined();
    expect(screen.getByLabelText('Name').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Name'));
    expect(sent).toEqual([]);
  });

  it('offers the currencies in use today, by name then code, and not the retired ones', () => {
    settings();

    const offered = [...(screen.getByLabelText('Currency') as HTMLSelectElement).options];

    expect(offered.map(({ value }) => value)).toContain('SLE');
    expect(offered.map(({ value }) => value)).toContain('ZWG');
    expect(offered.map(({ value }) => value)).not.toContain('SLL');
    expect(offered.map(({ value }) => value)).not.toContain('ZWL');
    expect(offered.map(({ value }) => value)).not.toContain('XXX');
    expect(offered.find(({ value }) => value === 'NGN')?.textContent).toBe('Nigerian Naira (NGN)');
  });

  it('keeps a held currency that is no longer in use, first and chosen, through a save of the name', async () => {
    const held = membership({ id: 'org_1', name: 'Ìrè Events', currency: 'SLL' });
    signedIn(held);
    const sent = answering(
      (body) =>
        new Response(JSON.stringify({ ...held, ...(body as object), role: undefined }), {
          status: 200,
        }),
    );
    settings();

    const currency = screen.getByLabelText('Currency') as HTMLSelectElement;
    expect(currency.value).toBe('SLL');
    expect(currency.options[0]?.textContent).toBe('SLL (no longer in use)');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ìrè Events Ltd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.getByRole('status')).toBeDefined());
    expect(
      sent.filter((request) => request.path.startsWith('/api/orgs') && request.method !== 'GET'),
    ).toEqual([{ method: 'PATCH', path: '/api/orgs/org_1', body: { name: 'Ìrè Events Ltd' } }]);
  });

  it('starts an organisation with no currency of its own empty, and refuses to save it so', () => {
    signedIn(membership({ id: 'org_1', name: 'Ìrè Events', countryCode: 'AQ', currency: '' }));
    const sent = answering(() => new Response('{}', { status: 500 }));
    settings();

    const currency = screen.getByLabelText('Currency') as HTMLSelectElement;
    expect(currency.value).toBe('');
    expect(currency.options[0]?.textContent).toBe('Choose a currency');

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Choose a currency.')).toBeDefined();
    expect(currency.getAttribute('aria-invalid')).toBe('true');
    expect(sent).toEqual([]);

    fireEvent.change(currency, { target: { value: 'USD' } });
    expect([...currency.options].map(({ value }) => value)).not.toContain('');
  });

  it("shows the API's refusal under the field it names", async () => {
    answering(
      () =>
        new Response(
          JSON.stringify({
            type: 'https://soirely.com/errors/validation_failed',
            title: 'No.',
            status: 422,
            violations: [
              {
                propertyPath: 'timezone',
                message: 'Elija una zona horaria.',
                code: 'validation_failed',
              },
            ],
          }),
          { status: 422 },
        ),
    );
    settings();

    fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'Europe/Lisbon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.getByText('Elija una zona horaria.')).toBeDefined());
    expect(screen.getByLabelText('Time zone').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Time zone'));
  });

  it('shows the details as text, with no controls, to a role that cannot change them', () => {
    signedIn(
      membership({
        role: { id: 'role_2', seededAs: 'coordinator', name: null },
        permissions: ['events.read', 'events.manage', 'budget.read'],
      }),
    );
    settings();

    expect(screen.getByText('hello@ire.events')).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(
      screen.getByText(/Your role, Coordinator, can see these but not change them/),
    ).toBeDefined();
  });

  it('lists the details in the order of the form, then the defaults note, then the role line', () => {
    signedIn(
      membership({
        role: { id: 'role_2', seededAs: 'coordinator', name: null },
        permissions: ['events.read'],
      }),
    );
    settings();

    const terms = screen.getAllByRole('term');

    expect(terms.slice(0, -1).map((term) => term.textContent)).toEqual([
      'Name',
      'Country',
      'Contact address',
      'Currency',
      'Time zone',
    ]);
    expect(terms.at(-1)).toBe(readOnlyLanguage().previousElementSibling);

    const note = screen.getByText(
      'Currency and time zone: new events start with these. Events you already have keep theirs.',
    );
    const role = screen.getByText(/Your role, Coordinator, can see these but not change them/);
    const list = document.querySelector('dl.settings-read-only');

    expect(list?.compareDocumentPosition(note)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(note.compareDocumentPosition(role)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(note.compareDocumentPosition(readOnlyLanguage())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});

describe('Settings > General, a request to get back in', () => {
  const REQUEST = {
    id: 'rq_1',
    name: 'Tope Bello',
    email: 'tope.bello@ire.events',
    provedPhone: false,
    own: false,
    organisations: ['Ìrè Events'],
    asked: 'Saturday, Oct 17 at 14:20 WAT',
    expires: 'Saturday, Oct 24 at 14:20 WAT',
  };

  it('shows who asked, what they proved and when it ends, and approves only once confirmed', async () => {
    const sent = answering(
      () => new Response(JSON.stringify({ requests: [REQUEST] }), { status: 200 }),
    );
    settings();

    expect(await screen.findByText('Tope Bello')).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Requests to get back in' }),
    ).toBeDefined();
    expect(document.getElementById('requests')).not.toBeNull();
    expect(screen.getByText('Proved with a code to their email (no verified phone)')).toBeDefined();
    expect(
      screen.getByText(
        'Asked Saturday, Oct 17 at 14:20 WAT · ends Saturday, Oct 24 at 14:20 WAT if nobody answers',
      ),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(
      screen.getByRole('heading', { name: 'Approve, and turn off Tope Bello’s two-factor?' }),
    ).toBeDefined();
    expect(sent.some((request) => request.path.endsWith('/approve'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Turn off two-factor' }));
    expect(await screen.findByText('Tope Bello’s two-factor is off.')).toBeDefined();
    expect(sent.at(-1)).toEqual({
      method: 'POST',
      path: '/api/auth/recovery-requests/rq_1/approve',
      body: null,
    });
    expect(screen.queryByText('Proved with a code to their email (no verified phone)')).toBeNull();
  });

  it('never offers an answer to your own request', async () => {
    answering(
      () =>
        new Response(
          JSON.stringify({ requests: [{ ...REQUEST, own: true, name: 'Folake Adeyemi' }] }),
          { status: 200 },
        ),
    );
    settings();

    expect(await screen.findByText('Folake Adeyemi (you)')).toBeDefined();
    expect(
      screen.getByText('This is your own request. Somebody else in Ìrè Events has to answer it.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });
});
