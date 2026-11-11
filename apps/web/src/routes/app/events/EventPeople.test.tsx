import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });
const MEMBER = membership({
  ...IRE,
  role: { id: 'role_3', seededAs: 'member', name: null },
  permissions: [],
});

const EVENT = {
  id: 'ev_1',
  organisationId: 'org_1',
  name: 'Adaeze and Tunde',
  type: 'wedding',
  status: 'live',
  startsAt: '2030-11-14T16:00:00+01:00',
  endsAt: '2030-11-15T02:00:00+01:00',
  timeZone: 'Africa/Lagos',
  dayCount: 2,
  currency: 'NGN',
  cover: null,
  venue: null,
  hosts: [],
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  pausedAt: null,
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
  permissions: OWNER_PERMISSIONS,
};

function person(id: string, name: string, role: string, jobLabel: string | null = null) {
  return {
    id: `p_${id}`,
    membershipId: `m_${id}`,
    user: { id: `u_${id}`, name },
    role,
    jobLabel,
    outside: false,
  };
}

const TOM = person('tom', 'Tom Becker', 'can_check_in', 'Bar and drinks');
const PRIYA = person('priya', 'Priya Shah', 'lead');
const ANA = person('ana', 'Ana Souza', 'can_edit');

/** What the API reads out on the event for each role, as `EventRole::permissions` gives it, cut to what this page asks. */
const ON_THE_EVENT: Record<string, string[]> = {
  lead: ['events.read', 'events.manage', 'people.read', 'people.manage'],
  can_edit: ['events.read', 'events.manage', 'people.read'],
  can_view: ['events.read', 'people.read'],
  can_check_in: ['events.read', 'people.read'],
};

let reader = IRE;

const MEMBERS = [
  { membershipId: 'm_folake', name: 'Folake Adeyemi', userId: 'u_folake' },
  { membershipId: 'm_julien', name: 'Julien Moreau', userId: 'u_julien' },
  { membershipId: 'm_tom', name: 'Tom Becker', userId: 'u_tom' },
  { membershipId: 'm_kofi', name: 'Kofi Mensah', userId: 'u_kofi' },
  { membershipId: 'm_sade', name: 'Sade Bello', userId: 'u_sade' },
  { membershipId: 'm_priya', name: 'Priya Shah', userId: 'u_priya' },
];

function signedIn(organisation = IRE, userId = 'u_folake'): void {
  reader = organisation;
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId,
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ETag: '"1"', 'Content-Type': 'application/json' },
  });
}

type Answer = (body: unknown) => Response | Promise<Response>;

async function onPeople(
  people: ReturnType<typeof person>[],
  answers: Record<string, Answer> = {},
  userId = 'u_folake',
): Promise<{ line: string; body: unknown }[]> {
  const sent: { line: string; body: unknown }[] = [];
  const role = people.find((one) => one.user.id === userId)?.role;
  const holding =
    reader.role.seededAs === 'member' ? (ON_THE_EVENT[role ?? ''] ?? []) : reader.permissions;

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    const answer = answers[line];
    if (answer != null) return answer(body);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, permissions: holding } });
    if (line === 'GET /api/events/ev_1/people')
      return json({ people, owners: ['Folake Adeyemi'], admins: ['Julien Moreau'] });
    if (line === 'GET /api/events/ev_1/people/addable')
      return json({
        members: MEMBERS.filter(
          (one) =>
            one.userId !== userId && !people.some((on) => on.membershipId === one.membershipId),
        ).map(({ membershipId, name }) => ({ membershipId, name })),
      });

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/people'] })}
    />,
  );
  await screen.findByRole('heading', { level: 2, name: 'People' });

  return sent;
}

function people(): HTMLElement {
  return screen.getByRole('region', { name: 'People' });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('People on an event, at a desk (sc-29915)', () => {
  it('draws its buttons and lists as the demo does, with none of the browser’s own look', () => {
    const parts = readFileSync(
      join(import.meta.dirname, '../../../components/SettingsParts.css'),
      'utf8',
    );
    const rule = (selector: string) => parts.split(`\n${selector} {`)[1]?.split('}')[0] ?? '';

    expect(rule(':where(.desk) button')).toMatch(
      /border: 0;[\s\S]*background: none;[\s\S]*text-align: start;/u,
    );
    expect(rule(':where(.desk) :is(h1, h2, h3, p, ul, ol)')).toMatch(
      /margin: 0;[\s\S]*padding: 0;/u,
    );
    expect(rule(':where(.desk) :is(ul, ol)')).toMatch(/list-style: none;/u);
  });

  it('lists everyone by role, then by name, each with their role and job label', async () => {
    signedIn();
    await onPeople([TOM, ANA, PRIYA]);

    const rows = within(people())
      .getAllByRole('listitem')
      .map((row) => row.textContent);

    expect(rows).toEqual([
      expect.stringContaining('Priya ShahLead'),
      expect.stringContaining('Ana SouzaCan edit'),
      expect.stringContaining('Tom BeckerCan check guests in · Bar and drinks'),
    ]);
    expect(
      screen.getByRole('heading', { level: 2, name: 'People' }).closest('.desk'),
    ).not.toBeNull();
    expect(within(people()).getByText('3')).toBeDefined();
    expect(
      await within(people()).findByText(
        'Folake Adeyemi and Julien Moreau see every event, as owner and admin of Ìrè Events.',
      ),
    ).toBeDefined();
    expect(
      screen
        .getAllByRole('link', { name: 'People' })
        .some((link) => link.getAttribute('aria-current') === 'page'),
    ).toBe(true);
  });

  it('shows a new event as nobody on it, with Add for an owner', async () => {
    signedIn();
    await onPeople([]);

    expect(within(people()).getByText('Nobody is on this event yet.')).toBeDefined();
    expect(await within(people()).findByRole('button', { name: 'Add by name' })).toBeDefined();
  });

  it('gives somebody who only reads it no Add, nothing that opens, and who changes it', async () => {
    signedIn(MEMBER, 'u_ana');
    const sent = await onPeople([PRIYA, ANA], {}, 'u_ana');

    expect(within(people()).queryByRole('button')).toBeNull();
    expect(within(people()).getByText('Can edit · You')).toBeDefined();
    expect(
      within(people()).getByText('Only owners, admins and the lead change who’s on this event.'),
    ).toBeDefined();
    expect(
      within(people()).getByText(
        'Folake Adeyemi and Julien Moreau see every event, as owner and admin of Ìrè Events.',
      ),
    ).toBeDefined();
    expect(sent.some((one) => one.line === 'GET /api/events/ev_1/people/addable')).toBe(false);
    expect(sent.some((one) => one.line.startsWith('GET /api/orgs/'))).toBe(false);
  });

  it('lets the event’s lead open everyone but themselves, and add members without Members', async () => {
    signedIn(MEMBER, 'u_priya');
    const sent = await onPeople([PRIYA, ANA], {}, 'u_priya');

    expect(within(people()).getByText('Lead · You')).toBeDefined();
    expect(within(people()).getByRole('button', { name: /Ana Souza/ })).toBeDefined();
    expect(within(people()).queryByRole('button', { name: /Priya Shah/ })).toBeNull();

    fireEvent.click(await within(people()).findByRole('button', { name: 'Add by name' }));
    const dialog = screen.getByRole('dialog', { name: 'Add people' });

    expect(within(dialog).getByRole('checkbox', { name: 'Folake Adeyemi' })).toBeDefined();
    expect(within(dialog).queryByRole('checkbox', { name: /Priya Shah/ })).toBeNull();
    expect(sent.some((one) => one.line.startsWith('GET /api/orgs/'))).toBe(false);
  });

  it('saves a role as it is picked, keeps the dialog open, and Done returns focus', async () => {
    signedIn();
    const sent = await onPeople([PRIYA, TOM], {
      'PATCH /api/events/ev_1/people/p_tom': () => json({ person: { ...TOM, role: 'can_view' } }),
    });
    const row = within(people()).getByRole('button', { name: /Tom Becker/ });

    fireEvent.click(row);
    const dialog = screen.getByRole('dialog', { name: 'Role on this event' });
    const group = within(dialog).getByRole('group', { name: 'Tom Becker’s role on this event' });

    expect(document.activeElement).toBe(
      within(group).getByRole('radio', { name: /Can check guests in/ }),
    );

    fireEvent.click(within(group).getByRole('radio', { name: /Can view/ }));

    expect(await within(dialog).findByText('Saved. Tom Becker can view now.')).toBeDefined();
    expect(sent.find((one) => one.line === 'PATCH /api/events/ev_1/people/p_tom')?.body).toEqual({
      role: 'can_view',
    });
    expect(screen.getByRole('dialog', { name: 'Role on this event' })).toBeDefined();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(people()).getByRole('button', { name: /Tom Becker/ }),
      ),
    );
    expect(within(people()).getByRole('button', { name: /Tom Becker/ }).className).toContain(
      'is-on',
    );
    expect(within(people()).getByText('Can view · Bar and drinks')).toBeDefined();
  });

  it('puts the radio back and says so when a change fails', async () => {
    signedIn();
    await onPeople([TOM], {
      'PATCH /api/events/ev_1/people/p_tom': () => {
        throw new TypeError('offline');
      },
    });

    fireEvent.click(within(people()).getByRole('button', { name: /Tom Becker/ }));
    const dialog = screen.getByRole('dialog', { name: 'Role on this event' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Can edit/ }));

    expect(
      await within(dialog).findByText(
        'We couldn’t change Tom Becker’s role, so it’s still Can check guests in. Check your connection and pick again.',
      ),
    ).toBeDefined();
    expect(
      (within(dialog).getByRole('radio', { name: /Can check guests in/ }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it('asks before removing, shows it removing, then says the person is off this event', async () => {
    signedIn();
    let answer: (done: Response) => void = () => {};
    const sent = await onPeople([PRIYA, TOM], {
      'DELETE /api/events/ev_1/people/p_tom': () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });

    fireEvent.click(within(people()).getByRole('button', { name: /Tom Becker/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from this event…' }));
    const ask = screen.getByRole('alertdialog', { name: 'Remove Tom Becker from this event?' });

    expect(
      within(ask).getByText('They lose this event on their next request. They stay in Ìrè Events.'),
    ).toBeDefined();
    const keep = within(ask).getByRole('button', { name: 'Keep Tom' });

    expect(document.activeElement).toBe(keep);
    expect(keep.getAttribute('title')).toBeNull();

    fireEvent.click(within(ask).getByRole('button', { name: 'Remove' }));
    const removing = await within(ask).findByRole('button', { name: 'Removing…' });

    expect(removing.getAttribute('aria-busy')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('alertdialog', { name: /Remove Tom Becker/ })).toBe(ask);

    answer(new Response(null, { status: 204 }));

    expect(await screen.findByText('Tom Becker is off this event.')).toBeDefined();
    expect(sent.some((one) => one.line === 'DELETE /api/events/ev_1/people/p_tom')).toBe(true);
    expect(within(people()).queryByText('Tom Becker')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(people()).getByRole('button', { name: 'Add by name' }),
      ),
    );
  });

  it('keeps the radios enabled and focused while saving, and sends an arrowed role once the arrows rest', async () => {
    signedIn();
    const sent = await onPeople([PRIYA, TOM], {
      'PATCH /api/events/ev_1/people/p_tom': (body) =>
        json({ person: { ...TOM, role: (body as { role: string }).role } }),
    });
    const patches = () => sent.filter((one) => one.line === 'PATCH /api/events/ev_1/people/p_tom');

    fireEvent.click(within(people()).getByRole('button', { name: /Tom Becker/ }));
    const dialog = screen.getByRole('dialog', { name: 'Role on this event' });
    const radio = (name: RegExp) => within(dialog).getByRole('radio', { name }) as HTMLInputElement;
    const arrowTo = (name: RegExp) => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowUp' });
      fireEvent.click(radio(name));
      radio(name).focus();
    };

    arrowTo(/Can view/);
    arrowTo(/Can edit/);

    expect(patches()).toEqual([]);
    expect(radio(/Can edit/).disabled).toBe(false);
    expect(document.activeElement).toBe(radio(/Can edit/));

    expect(
      await within(dialog).findByText('Saved. Tom Becker can edit now.', {}, { timeout: 2000 }),
    ).toBeDefined();
    expect(patches().map((one) => one.body)).toEqual([{ role: 'can_edit' }]);
    expect(document.activeElement).toBe(radio(/Can edit/));

    radio(/Can view/).focus();
    fireEvent.click(radio(/Can view/));
    await within(dialog).findByText('Saved. Tom Becker can view now.');
    expect(patches().map((one) => one.body)).toEqual([{ role: 'can_edit' }, { role: 'can_view' }]);
    expect(document.activeElement).toBe(radio(/Can view/));
  });

  it('sends nothing when the arrows come back to the role it has', async () => {
    signedIn();
    const sent = await onPeople([TOM]);

    fireEvent.click(within(people()).getByRole('button', { name: /Tom Becker/ }));
    const dialog = screen.getByRole('dialog', { name: 'Role on this event' });
    const radio = (name: RegExp) => within(dialog).getByRole('radio', { name }) as HTMLInputElement;
    fireEvent.keyDown(radio(/Can check guests in/), { key: 'ArrowUp' });
    fireEvent.click(radio(/Can view/));
    fireEvent.keyDown(radio(/Can view/), { key: 'ArrowDown' });
    fireEvent.click(radio(/Can check guests in/));
    await new Promise((resolve) => setTimeout(resolve, 800));

    expect(sent.filter((one) => one.line.startsWith('PATCH '))).toEqual([]);
    expect(within(dialog).queryByText(/Saving/)).toBeNull();
  });

  it('names a lone owner in the singular', async () => {
    signedIn();
    await onPeople([TOM], {
      'GET /api/events/ev_1/people': () =>
        json({ people: [TOM], owners: ['Folake Adeyemi'], admins: [] }),
    });

    expect(
      await within(people()).findByText('Folake Adeyemi sees every event, as owner of Ìrè Events.'),
    ).toBeDefined();
  });

  it('names a lone admin as admin, when the only owner is suspended', async () => {
    signedIn();
    await onPeople([TOM], {
      'GET /api/events/ev_1/people': () =>
        json({ people: [TOM], owners: [], admins: ['Julien Moreau'] }),
    });

    expect(
      await within(people()).findByText('Julien Moreau sees every event, as admin of Ìrè Events.'),
    ).toBeDefined();
  });

  it('names each role it finds, in the plural where more than one holds it', async () => {
    signedIn();
    await onPeople([TOM], {
      'GET /api/events/ev_1/people': () =>
        json({ people: [TOM], owners: ['Folake Adeyemi', 'Ade Bello'], admins: ['Julien Moreau'] }),
    });

    expect(
      await within(people()).findByText(
        'Folake Adeyemi, Ade Bello and Julien Moreau see every event, as owners and admin of Ìrè Events.',
      ),
    ).toBeDefined();
  });

  it('adds members not yet on the event at the role picked, by keyboard alone', async () => {
    signedIn();
    const sent = await onPeople([TOM], {
      'POST /api/events/ev_1/people': (body) => {
        const { membershipId, role: picked } = body as { membershipId: string; role: string };
        const one = MEMBERS.find((each) => each.membershipId === membershipId);

        return json({ person: person(membershipId.slice(2), one?.name ?? '', picked) }, 201);
      },
    });

    const add = await within(people()).findByRole('button', { name: 'Add by name' });
    add.focus();
    fireEvent.click(add);
    const dialog = screen.getByRole('dialog', { name: 'Add people' });
    const find = within(dialog).getByRole('textbox', { name: 'Name' });

    expect(document.activeElement).toBe(find);
    expect(within(dialog).queryByRole('checkbox', { name: /Tom Becker/ })).toBeNull();
    expect(within(dialog).queryByRole('checkbox', { name: /Folake Adeyemi/ })).toBeNull();
    expect(
      within(dialog)
        .getAllByRole('checkbox')
        .map((box) => box.closest('label')?.textContent),
    ).toEqual(['JMJulien Moreau', 'KMKofi Mensah', 'PSPriya Shah', 'SBSade Bello']);
    expect(
      (within(dialog).getByRole('radio', { name: /Can view/ }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(within(dialog).getByRole('button', { name: 'Add' }).getAttribute('aria-disabled')).toBe(
      'true',
    );

    fireEvent.change(find, { target: { value: 'zz' } });
    expect(within(dialog).getByText('Nobody in Ìrè Events matches “zz”.')).toBeDefined();

    fireEvent.change(find, { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Can edit/ }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Kofi Mensah/ }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Sade Bello/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('2 people can edit now.')).toBeDefined();
    expect(
      sent.filter((one) => one.line === 'POST /api/events/ev_1/people').map((one) => one.body),
    ).toEqual([
      { membershipId: 'm_kofi', role: 'can_edit' },
      { membershipId: 'm_sade', role: 'can_edit' },
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(add);
  });

  it('lists the people a half-failed batch added, and keeps the rest ticked', async () => {
    signedIn();
    await onPeople([TOM], {
      'POST /api/events/ev_1/people': (body) => {
        const { membershipId } = body as { membershipId: string };
        if (membershipId === 'm_sade') throw new TypeError('offline');

        return json({ person: person('kofi', 'Kofi Mensah', 'can_view') }, 201);
      },
    });

    fireEvent.click(await within(people()).findByRole('button', { name: 'Add by name' }));
    const dialog = screen.getByRole('dialog', { name: 'Add people' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Kofi Mensah/ }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Sade Bello/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(
      await within(dialog).findByText(
        'Adding did not work. Nobody else was added. Try again in a moment.',
      ),
    ).toBeDefined();
    expect(within(people()).getByText('Kofi Mensah')).toBeDefined();
    expect(within(dialog).queryByRole('checkbox', { name: /Kofi Mensah/ })).toBeNull();
    expect(
      (within(dialog).getByRole('checkbox', { name: /Sade Bello/ }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('says why the API refused an add, in its own words', async () => {
    signedIn();
    await onPeople([TOM], {
      'POST /api/events/ev_1/people': () =>
        json(
          {
            type: 'https://soirely.com/errors/validation_failed',
            title: 'Some of the information provided is not valid.',
            status: 422,
            violations: [
              {
                propertyPath: 'membershipId',
                message: 'This person is already on this event.',
                code: 'validation_failed',
              },
            ],
          },
          422,
        ),
    });

    fireEvent.click(await within(people()).findByRole('button', { name: 'Add by name' }));
    const dialog = screen.getByRole('dialog', { name: 'Add people' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Kofi Mensah/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(await within(dialog).findByText('This person is already on this event.')).toBeDefined();
  });

  it('keeps Tab inside an open dialog, and asks before discarding a tick', async () => {
    signedIn();
    await onPeople([TOM]);

    fireEvent.click(await within(people()).findByRole('button', { name: 'Add by name' }));
    const dialog = screen.getByRole('dialog', { name: 'Add people' });
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    const last = within(dialog).getByRole('checkbox', { name: /Sade Bello/ });
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });

    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(last);

    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Kofi Mensah/ }));
    fireEvent.keyDown(document, { key: 'Escape' });

    const ask = screen.getByRole('alertdialog', { name: 'Discard your changes?' });
    const keep = within(ask).getByRole('button', { name: 'Keep adding' });
    const discard = within(ask).getByRole('button', { name: 'Discard' });
    discard.focus();
    fireEvent.keyDown(document, { key: 'Tab' });

    expect(document.activeElement).toBe(keep);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(discard);
  });

  it('asks before discarding a role picked and nothing else', async () => {
    signedIn();
    await onPeople([TOM]);

    fireEvent.click(await within(people()).findByRole('button', { name: 'Add by name' }));
    const dialog = screen.getByRole('dialog', { name: 'Add people' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Can edit/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('alertdialog', { name: 'Discard your changes?' })).toBeDefined();
  });

  it('closes on Cancel without asking when only a name was typed', async () => {
    signedIn();
    await onPeople([TOM]);

    const add = await within(people()).findByRole('button', { name: 'Add by name' });
    add.focus();
    fireEvent.click(add);
    const dialog = screen.getByRole('dialog', { name: 'Add people' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Kofi' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(add));
  });

  it('names the way back by the first name, and keeps the title’s full name', async () => {
    const long = person('max', 'Maximiliana Fernández-Castellanos de la Vega', 'can_view');
    const word = person('olu', 'Oluwatobilobaoluwadamilareadebayoakinola', 'can_view');
    signedIn();
    await onPeople([PRIYA, long, word]);

    fireEvent.click(within(people()).getByRole('button', { name: /Maximiliana/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from this event…' }));
    const ask = screen.getByRole('alertdialog', {
      name: 'Remove Maximiliana Fernández-Castellanos de la Vega from this event?',
    });

    expect(within(ask).getByRole('button', { name: 'Keep Maximiliana' })).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep Maximiliana' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.click(within(people()).getByRole('button', { name: /Oluwatobiloba/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from this event…' }));

    expect(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Keep Oluwatobilobaoluwadamilareadebayoakinola',
      }),
    ).toBeDefined();
  });

  it('keeps Tab inside the ask before removing, never in the dialog behind it', async () => {
    signedIn();
    await onPeople([PRIYA, TOM]);

    fireEvent.click(within(people()).getByRole('button', { name: /Tom Becker/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from this event…' }));
    const ask = screen.getByRole('alertdialog', { name: 'Remove Tom Becker from this event?' });

    await waitFor(() =>
      expect(document.activeElement).toBe(within(ask).getByRole('button', { name: 'Keep Tom' })),
    );
    const keep = within(ask).getByRole('button', { name: 'Keep Tom' });
    const remove = within(ask).getByRole('button', { name: 'Remove' });
    remove.focus();
    fireEvent.keyDown(document, { key: 'Tab' });

    expect(document.activeElement).toBe(keep);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(remove);
  });

  it('says it could not load, and loads again on Try again', async () => {
    signedIn();
    let calls = 0;
    await onPeople([TOM], {
      'GET /api/events/ev_1/people': () => {
        calls += 1;
        return calls === 1 ? json({}, 500) : json({ people: [TOM], owners: [], admins: [] });
      },
    }).catch(() => undefined);

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(within(people()).getByText('Tom Becker')).toBeDefined());
  });
});
