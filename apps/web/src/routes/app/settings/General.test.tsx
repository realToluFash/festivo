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
    timezone: null,
  };

  __setSessionState({ status: 'signedIn', session });
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
  __setSessionState({ status: 'unknown' });
});

describe('Settings > General', () => {
  it("shows the five fields with the organisation's values", () => {
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
    expect(sent).toEqual([
      { method: 'PATCH', path: '/api/orgs/org_1', body: { name: 'Ìrè Events Ltd' } },
    ]);
    expect(screen.getByLabelText('Organisation: Ìrè Events Ltd, your role Owner')).toBeDefined();
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
    expect(screen.getByText(/That doesn't look like an email address/)).toBeDefined();
    expect(screen.getByLabelText('Name').getAttribute('aria-invalid')).toBe('true');
    expect(sent).toEqual([]);
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
  });

  it('shows the details as text, with no controls, to a role that cannot change them', () => {
    signedIn(membership({ role: { id: 'role_2', seededAs: 'coordinator', name: null } }));
    settings();

    expect(screen.getByText('hello@ire.events')).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(
      screen.getByText(/Your role, Coordinator, can see these but not change them/),
    ).toBeDefined();
  });
});
