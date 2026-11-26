import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const EVENT = {
  id: 'ev_1',
  organisationId: 'org_1',
  name: 'Adaeze and Tunde',
  type: 'wedding',
  status: 'live',
  startsAt: '2030-11-15T18:00:00+01:00',
  endsAt: '2030-11-16T02:00:00+01:00',
  timeZone: 'Africa/Lagos',
  dayCount: 1,
  currency: 'NGN',
  cover: null,
  venue: null,
  arrivalNote: null,
  hosts: [],
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  pausedAt: null,
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
  permissions: OWNER_PERMISSIONS,
};

function signedIn(): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u_folake',
    needsOrganisation: false,
    hasPassword: true,
    organisation: IRE,
    organisations: [IRE],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

async function previewOn(): Promise<void> {
  const button = screen.getByRole('button', { name: 'Preview' });
  await waitFor(() => expect(button.getAttribute('aria-disabled')).toBe('false'));
  fireEvent.click(button);
}

function writeMessage(field: HTMLElement, words: string): void {
  field.textContent = words;
  fireEvent.input(field);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ETag: '"1"', 'Content-Type': 'application/json' },
  });
}

type Answer = (body: unknown) => Response | Promise<Response>;

const GUESTS = [
  { id: 'g_kwame', name: 'Kwame Mensah', flag: 'no_address', email: null, language: 'fr' },
  { id: 'g_ada', name: 'Ada Obi', flag: null, email: 'ada@example.test', language: 'en' },
];

const SENT = {
  id: 'm_1',
  subject: null,
  firstLine: 'Dinner starts at seven',
  message: 'Dinner starts at seven',
  audience: 'all',
  channels: ['email'],
  sentBy: 'Folake Adeyemi',
  sentAt: '2030-11-10T19:42:00+01:00',
  reached: 1,
  sending: false,
  deliveries: [
    {
      guestId: 'g_ada',
      name: 'Ada Obi',
      channel: 'email',
      state: 'delivered',
      reason: null,
      code: null,
      at: null,
      address: 'ada@example.test',
    },
    {
      guestId: 'g_bisi',
      name: 'Bisi Ade',
      channel: 'email',
      state: 'bounced',
      reason: null,
      code: '5.1.1',
      at: null,
      address: 'bisi@example.test',
    },
    {
      guestId: 'g_kwame',
      name: 'Kwame Mensah',
      channel: 'email',
      state: 'not_sent',
      reason: 'no_address',
      code: null,
      at: null,
      address: null,
    },
  ],
};

type Condition = { type: string; groupId?: string | null };

const GROUPS = { grp_family: 'Family', grp_work: 'Work', grp_old: 'Old friends' } as const;

const PEOPLE = [
  {
    id: 'g_ada',
    name: 'Ada Obi',
    reply: 'coming',
    invited: true,
    group: 'grp_family',
    email: true,
    mobile: true,
  },
  {
    id: 'g_bisi',
    name: 'Bisi Ade',
    reply: null,
    invited: true,
    group: 'grp_family',
    email: true,
    mobile: false,
  },
  {
    id: 'g_kwame',
    name: 'Kwame Mensah',
    reply: null,
    invited: false,
    group: null,
    email: false,
    mobile: true,
  },
];

function shown(condition: Condition) {
  if (condition.type !== 'inGroup' || condition.groupId == null) return condition;
  const id = condition.groupId as keyof typeof GROUPS;

  return { ...condition, group: { name: GROUPS[id], deleted: id === 'grp_old' } };
}

function matched(conditions: Condition[]) {
  const fits = (person: (typeof PEOPLE)[number], condition: Condition): boolean => {
    switch (condition.type) {
      case 'coming':
        return person.reply === 'coming';
      case 'notReplied':
        return person.invited && person.reply == null;
      case 'hasMobile':
        return person.mobile;
      case 'hasEmail':
        return person.email;
      case 'inGroup':
        return condition.groupId !== 'grp_old' && person.group === condition.groupId;
      default:
        return false;
    }
  };
  const guests = PEOPLE.filter((person) => conditions.every((one) => fits(person, one))).map(
    ({ id, name, email, mobile }) => ({ id, name, email, mobile }),
  );

  return { count: guests.length, conditions: conditions.map(shown), guests };
}

const COMING_MOBILE = {
  id: 'a_cm',
  name: 'Coming, with a mobile',
  conditions: [{ type: 'coming' }, { type: 'hasMobile' }],
};

const BOOK = {
  audiences: [
    COMING_MOBILE,
    {
      id: 'a_school',
      name: 'School crowd',
      conditions: [shown({ type: 'inGroup', groupId: 'grp_old' })],
    },
  ],
  groups: [
    { id: 'grp_family', name: 'Family' },
    { id: 'grp_work', name: 'Work' },
  ],
};

function onMessages(
  answers: Record<string, Answer> = {},
  event: Record<string, unknown> = {},
  arriving: unknown = null,
): { line: string; body: unknown }[] {
  const sent: { line: string; body: unknown }[] = [];
  signedIn();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    sent.push({ line, body });
    const answer = answers[line];
    if (answer != null) return answer(body);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, ...event } });
    if (line === 'GET /api/events/ev_1/messages') return json({ messages: [] });
    if (line === 'GET /api/events/ev_1/messages/guests') return json({ guests: GUESTS });
    if (line === 'GET /api/events/ev_1/messages/audiences') return json(BOOK);
    if (line === 'POST /api/events/ev_1/messages/audience')
      return json(matched((body as { conditions: Condition[] }).conditions));

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, {
        initialEntries: [{ pathname: '/app/events/ev_1/messages', state: arriving }],
      })}
    />,
  );

  return sent;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Messages at a desk (sc-3942)', () => {
  it('says why Send refuses, every field at once, before asking the API', async () => {
    const sent = onMessages();

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Subject' }), {
      target: { value: 's'.repeat(151) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Shorten the subject to 150 characters or fewer.')).toBeTruthy();
    expect(screen.getByText('Enter a message.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Subject' }));
    expect(sent.some(({ line }) => line.startsWith('POST'))).toBe(false);
  });

  it('counts every guest on the waiting composer’s To', async () => {
    onMessages();

    expect(await screen.findByRole('button', { name: 'All guests · 2' })).toBeTruthy();
  });

  it('counts nobody on the waiting composer’s To when the guests fail to load', async () => {
    const sent = onMessages({
      'GET /api/events/ev_1/messages/guests': () => new Response(null, { status: 500 }),
    });

    await waitFor(() =>
      expect(sent.some(({ line }) => line === 'GET /api/events/ev_1/messages/guests')).toBe(true),
    );
    expect(await screen.findByRole('button', { name: 'All guests' })).toBeTruthy();
  });

  it('threads a follow-up under its message, and writes the next one into the same conversation', async () => {
    const FOLLOW = {
      ...SENT,
      id: 'm_2',
      firstLine: 'Parking is behind the hall',
      message: 'Parking is behind the hall',
      sentAt: '2030-11-10T20:05:00+01:00',
      audience: 'chosen',
      sending: true,
      deliveries: [{ ...SENT.deliveries[0], state: 'queued' }],
      follows: 'm_1' as string | null,
    };
    const row = ({ message: _body, deliveries, ...summary }: typeof FOLLOW) => ({
      ...summary,
      deliveries: deliveries.length,
    });
    const sent = onMessages({
      'GET /api/events/ev_1/messages': () =>
        json({ messages: [row(FOLLOW), row({ ...FOLLOW, ...SENT, follows: null })] }),
      'GET /api/events/ev_1/messages/m_1': () => json({ message: { ...SENT, follows: null } }),
      'GET /api/events/ev_1/messages/m_2': () => json({ message: FOLLOW }),
      'POST /api/events/ev_1/messages/check': () =>
        json({ people: 3, toldByEmail: 2, cantBeTold: [] }),
      'POST /api/events/ev_1/messages': () =>
        json({ id: 'm_3', queued: { email: 2 }, notSent: { email: 1 } }, 202),
    });

    const rows = await screen.findAllByRole('button', { name: /Dinner starts at seven/ });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.getAttribute('aria-label')).toMatch(
      /^Dinner starts at seven, Follow-up · To all guests · /,
    );

    fireEvent.click(rows[0] as HTMLElement);
    expect(await screen.findByText('Parking is behind the hall')).toBeTruthy();
    expect(screen.getAllByText('Dinner starts at seven').length).toBeGreaterThan(0);

    const field = screen.getByRole('textbox', { name: 'Write a follow-up' });
    const followLine = /^A follow-up goes to the same \d+ guests?, under the first message/;
    expect(screen.getAllByText(followLine)).toHaveLength(2);
    expect(screen.queryByText('To')).toBeNull();
    fireEvent.focus(field);
    expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull();

    fireEvent.change(field, { target: { value: 'G' } });
    const body = await screen.findByRole('textbox', { name: 'Message' });
    expect(body.textContent).toBe('G');
    expect(screen.queryByRole('textbox', { name: 'Subject' })).toBeNull();
    expect(screen.queryByRole('button', { name: /All guests/ })).toBeNull();
    expect(screen.getByText(followLine)).toBeTruthy();

    writeMessage(body, 'Gates open at six');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Send to 3 people',
      }),
    );

    await waitFor(() =>
      expect(sent.find(({ line }) => line === 'POST /api/events/ev_1/messages')?.body).toEqual({
        audience: 'all',
        subject: null,
        message: 'Gates open at six',
        follows: 'm_1',
      }),
    );
    expect(sent.find(({ line }) => line === 'POST /api/events/ev_1/messages/check')?.body).toEqual({
      audience: 'all',
      follows: 'm_1',
    });
  });

  it('checks, then sends to all guests, and opens what went', async () => {
    const sent = onMessages({
      'POST /api/events/ev_1/messages/check': () =>
        json({
          people: 2,
          toldByEmail: 1,
          cantBeTold: [{ guestId: 'g_kwame', name: 'Kwame Mensah', reason: 'no_address' }],
        }),
      'POST /api/events/ev_1/messages': () =>
        json({ id: 'm_1', queued: { email: 1 }, notSent: { email: 1 } }, 202),
      'GET /api/events/ev_1/messages/m_1': () => json({ message: SENT }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'Dinner starts at seven');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    const check = await screen.findByRole('alertdialog');
    expect(within(check).getByText('Sending to 2 people cannot be undone.')).toBeTruthy();
    expect(within(check).getByText('Kwame Mensah · No email address')).toBeTruthy();

    fireEvent.click(within(check).getByRole('button', { name: 'Send to 2 people' }));

    expect(await screen.findByRole('heading', { name: 'Dinner starts at seven' })).toBeTruthy();
    expect(sent.find(({ line }) => line === 'POST /api/events/ev_1/messages')?.body).toEqual({
      audience: 'all',
      subject: null,
      message: 'Dinner starts at seven',
      follows: null,
    });

    fireEvent.click(screen.getByRole('button', { name: /Who it reached/ }));
    const kwame = (await screen.findByText('Kwame Mensah')).closest('li');
    expect(kwame?.textContent).toContain('Not sent · No email address');
    expect(screen.getByText('Bisi Ade').closest('li')?.textContent).toContain(
      'Bounced · This address doesn’t exist (5.1.1)',
    );
  });

  it('lists the message being written at the top, lit, with whom it goes to', async () => {
    onMessages();

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    const row = screen.getByRole('button', {
      name: /^New message, To all guests · not sent yet, /,
    });
    expect(row.getAttribute('aria-current')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /All guests/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Choose guests' }));
    expect(
      await screen.findByRole('button', {
        name: /^New message, To chosen guests · not sent yet, /,
      }),
    ).toBeTruthy();
  });

  it('refuses Done with nobody chosen, under To', async () => {
    onMessages();

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    fireEvent.click(screen.getByRole('button', { name: /All guests/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Choose guests' }));
    await screen.findByRole('checkbox', { name: 'Ada Obi' });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.getByText('Choose at least one guest.')).toBeTruthy());
  });

  it('keeps New off on a Draft and says why', async () => {
    onMessages({}, { phase: 'draft', status: 'draft' });

    const add = await screen.findByRole('button', { name: 'New' });
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('messages-closed').textContent).toBe(
      'This event is a draft. Make it live to write to your guests.',
    );
  });

  it('says why nobody can write without messages.manage, where the composer would be', async () => {
    onMessages({}, { permissions: OWNER_PERMISSIONS.filter((one) => one !== 'messages.manage') });

    expect(await screen.findByText('Only someone who can change Messages can send.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^All guests/ })).toBeNull();
  });

  it('says why nobody can write under an open conversation without messages.manage', async () => {
    const { message: _body, deliveries, ...summary } = { ...SENT, follows: null };
    onMessages(
      {
        'GET /api/events/ev_1/messages': () =>
          json({ messages: [{ ...summary, deliveries: deliveries.length }] }),
        'GET /api/events/ev_1/messages/m_1': () => json({ message: { ...SENT, follows: null } }),
      },
      { permissions: OWNER_PERMISSIONS.filter((one) => one !== 'messages.manage') },
    );

    fireEvent.click(await screen.findByRole('button', { name: /^Dinner starts at seven/ }));

    expect(await screen.findByRole('log', { name: /Dinner starts at seven/ })).toBeTruthy();
    expect(screen.getByText('Only someone who can change Messages can send.')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Write a follow-up' })).toBeNull();
  });

  it('is refused without messages.read, and hidden from the nav', async () => {
    onMessages(
      {},
      { permissions: OWNER_PERMISSIONS.filter((one) => !one.startsWith('messages.')) },
    );

    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Messages' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
  });
});

function problem(code: string, status: number, violations?: unknown[]): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status, violations }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

async function openTo(answers: Record<string, Answer> = {}) {
  const sent = onMessages(answers);

  fireEvent.click(await screen.findByRole('button', { name: 'New' }));
  fireEvent.click(screen.getByRole('button', { name: /^All guests/ }));

  return { sent, to: await screen.findByRole('dialog', { name: 'To' }) };
}

function quick(name: 'Coming' | 'Hasn’t replied'): void {
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^${name}( \\d+)?$`, 'u') }));
}

function add(word: string, group?: string): void {
  fireEvent.click(screen.getByRole('button', { name: 'Add a condition' }));
  fireEvent.click(screen.getByRole('button', { name: word }));
  if (group != null) fireEvent.click(screen.getByRole('button', { name: group }));
}

function closeTo(): void {
  fireEvent.keyDown(document, { key: 'Escape' });
}

function chips(): string[] {
  return [...document.querySelectorAll('.mg-conds .mg-cond')].map((one) => one.textContent ?? '');
}

describe('Who gets it (sc-3957)', () => {
  it('copies a quick pick’s one condition into the message, with its chip and count', async () => {
    await openTo();

    quick('Coming');

    expect(chips()).toEqual(['Is coming']);
    expect(await screen.findByText('1 guest')).toBeTruthy();
    expect(screen.getByText('1 guest').getAttribute('role')).toBe('status');
    expect(screen.getByRole('button', { name: /^Coming · 1/ })).toBeTruthy();
  });

  it('counts again as conditions are added and removed, this message only', async () => {
    await openTo();
    quick('Hasn’t replied');
    expect(await screen.findByText('1 guest')).toBeTruthy();

    add('Is in group', 'Work');
    expect(screen.getByText('Counting…')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Guests who… · 1 guest/ })).toBeTruthy();
    expect(await screen.findByText('Nobody matches')).toBeTruthy();
    expect(screen.getByText('Changing a condition here changes this message only.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove condition: Is in group: Work' }));
    expect(await screen.findByText('1 guest')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'See who' }));
    expect(screen.getByRole('list', { name: 'See who' }).textContent).toBe(
      'Bisi Ade · Email address',
    );
  });

  it('names the group in the draft row of a message to conditions', async () => {
    await openTo();
    quick('Hasn’t replied');
    add('Is in group', 'Family');

    expect(
      await screen.findByRole('button', {
        name: /^New message, To Guests who… Hasn’t replied · Is in group: Family · not sent yet, /,
      }),
    ).toBeTruthy();
  });

  it('refuses Save and Send with no condition, saying why beside each', async () => {
    const { sent } = await openTo();
    fireEvent.click(screen.getByRole('radio', { name: 'Guests who…' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save this audience' }));
    const why =
      'Add a condition first. With none, Guests who… matches nobody, so there is nothing to send or save.';
    expect(screen.getByRole('alert').textContent).toBe(why);

    closeTo();
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'Please reply');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect((await screen.findByRole('alert')).textContent).toBe(why);
    expect(sent.some(({ line }) => line.endsWith('/messages/check'))).toBe(false);
  });

  it('refuses Send when nobody matches', async () => {
    const { sent } = await openTo();
    quick('Coming');
    add('Is in group', 'Work');
    expect(await screen.findByText('Nobody matches')).toBeTruthy();

    closeTo();
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'Hello');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Nobody matches these conditions, so there is no one to send it to.',
    );
    expect(sent.some(({ line }) => line.endsWith('/messages/check'))).toBe(false);
  });

  it('names a deleted group on its chip and refuses Send because of it', async () => {
    await openTo();

    fireEvent.click(await screen.findByRole('radio', { name: 'School crowd' }));

    expect(chips()).toEqual(['Is in group: Old friends (deleted)']);
    expect(
      screen.getByText(
        'Old friends was deleted from this event’s groups, so this condition matches nobody.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('From your saved audience “School crowd”')).toBeTruthy();

    closeTo();
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'Hello');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Nobody matches, because Old friends was deleted. Remove that condition or choose another audience to send it.',
    );
  });

  it('sends the message’s own conditions', async () => {
    const { sent } = await openTo({
      'POST /api/events/ev_1/messages/check': () =>
        json({ people: 1, toldByEmail: 1, cantBeTold: [] }),
      'POST /api/events/ev_1/messages': () =>
        json({ id: 'm_1', queued: { email: 1 }, notSent: { email: 0 } }, 202),
    });
    quick('Coming');
    await screen.findByText('1 guest');
    closeTo();
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'See you');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Send to 1 person',
      }),
    );

    await waitFor(() =>
      expect(sent.find(({ line }) => line === 'POST /api/events/ev_1/messages')?.body).toEqual({
        audience: 'conditions',
        conditions: [{ type: 'coming' }],
        subject: null,
        message: 'See you',
        follows: null,
      }),
    );
  });

  it('refuses a blank, a too long, a used name and a 21st audience, then saves', async () => {
    const full = {
      ...BOOK,
      audiences: Array.from({ length: 20 }, (_, n) => ({
        id: `a_${n}`,
        name: `Audience ${n}`,
        conditions: [{ type: 'coming' }],
      })),
    };
    let answer: () => Response = () => json(full);
    const { sent } = await openTo({
      'GET /api/events/ev_1/messages/audiences': () => answer(),
      'POST /api/events/ev_1/messages/audiences': (body) =>
        json({ audience: { id: 'a_new', ...(body as object) } }, 201),
    });
    quick('Hasn’t replied');
    fireEvent.click(screen.getByRole('button', { name: 'Save this audience' }));
    const field = screen.getByRole('textbox', { name: 'Name this audience' });
    const saveIt = () => fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));
    const said = () => screen.getByRole('alert').textContent;

    saveIt();
    expect(said()).toBe('Enter a name for this audience.');

    fireEvent.change(field, { target: { value: 'x'.repeat(61) } });
    expect(screen.getByText('61 of 60 characters')).toBeTruthy();
    saveIt();
    expect(said()).toBe('A saved audience’s name can be up to 60 characters.');

    fireEvent.change(field, { target: { value: 'AUDIENCE 3' } });
    saveIt();
    expect(said()).toBe('There is already a saved audience called Audience 3.');

    fireEvent.change(field, { target: { value: 'Reminder' } });
    saveIt();
    expect(said()).toBe(
      'This event has 20 saved audiences, the most it can have. Delete one to save another.',
    );
    expect(sent.some(({ line }) => line === 'POST /api/events/ev_1/messages/audiences')).toBe(
      false,
    );

    answer = () => json(BOOK);
    cleanup();
    await openTo({
      'POST /api/events/ev_1/messages/audiences': () => problem('audience_name_taken', 409),
    });
    quick('Hasn’t replied');
    fireEvent.click(screen.getByRole('button', { name: 'Save this audience' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name this audience' }), {
      target: { value: 'Reminder' },
    });
    saveIt();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'There is already a saved audience called Reminder.',
    );
  });

  it('saves the conditions under a name, and picks it', async () => {
    const { sent } = await openTo({
      'POST /api/events/ev_1/messages/audiences': (body) =>
        json({ audience: { id: 'a_new', ...(body as object) } }, 201),
    });
    quick('Hasn’t replied');
    fireEvent.click(screen.getByRole('button', { name: 'Save this audience' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name this audience' }), {
      target: { value: ' Reminder ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));

    const saved = await screen.findByRole('radio', { name: 'Reminder' });
    expect((saved as HTMLInputElement).checked).toBe(true);
    expect(
      sent.find(({ line }) => line === 'POST /api/events/ev_1/messages/audiences')?.body,
    ).toEqual({
      name: 'Reminder',
      conditions: [{ type: 'notReplied' }],
    });
    await waitFor(() =>
      expect(
        screen.getByText('Saved as Reminder. It is with your saved audiences, at the top of To.'),
      ).toBeTruthy(),
    );
  });

  it('renames a saved audience in place, focus back on its More actions', async () => {
    const { sent } = await openTo({
      'PATCH /api/events/ev_1/messages/audiences/a_cm': (body) =>
        json({ audience: { ...COMING_MOBILE, ...(body as object) } }),
    });

    fireEvent.click(
      await screen.findByRole('button', { name: 'More actions for Coming, with a mobile' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename “Coming, with a mobile”' }), {
      target: { value: 'Coming, mobiles' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('radio', { name: 'Coming, mobiles' })).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'More actions for Coming, mobiles' }),
      ),
    );
    expect(
      sent.find(({ line }) => line === 'PATCH /api/events/ev_1/messages/audiences/a_cm')?.body,
    ).toEqual({ name: 'Coming, mobiles' });
  });

  it('asks before deleting, Keep it focused, and keeps the conditions the message was picked from', async () => {
    const { sent } = await openTo({
      'DELETE /api/events/ev_1/messages/audiences/a_cm': () => new Response(null, { status: 204 }),
    });
    fireEvent.click(await screen.findByRole('radio', { name: 'Coming, with a mobile' }));
    expect(await screen.findByText('1 guest')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Coming, with a mobile' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete…/ }));
    const ask = screen.getByRole('alertdialog', {
      name: 'Delete the saved audience Coming, with a mobile?',
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(ask).getByRole('button', { name: 'Keep it' })),
    );
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete saved audience' }));

    await waitFor(() =>
      expect(screen.queryByRole('radio', { name: 'Coming, with a mobile' })).toBeNull(),
    );
    expect(
      sent.some(({ line }) => line === 'DELETE /api/events/ev_1/messages/audiences/a_cm'),
    ).toBe(true);
    expect((screen.getByRole('radio', { name: 'Guests who…' }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(chips()).toEqual(['Is coming', 'Has a mobile number']);
    expect(screen.getByText('1 guest')).toBeTruthy();
  });

  it('opens on Hasn’t replied from the Guests card’s Write to them', async () => {
    onMessages({}, {}, { write: 'notReplied' });

    expect(await screen.findByRole('button', { name: /^Hasn’t replied · 1/ })).toBeTruthy();
  });

  it('says what a message to conditions was worked out to when it went', async () => {
    const TO_COMING = {
      ...SENT,
      audience: 'conditions',
      conditions: [{ type: 'coming' }, shown({ type: 'inGroup', groupId: 'grp_family' })],
      sentAt: '2030-11-10T10:00:00+01:00',
    };
    onMessages({
      'GET /api/events/ev_1/messages': () =>
        json({ messages: [{ ...TO_COMING, message: undefined, deliveries: 3, follows: null }] }),
      'GET /api/events/ev_1/messages/m_1': () => json({ message: { ...TO_COMING, follows: null } }),
    });

    const row = await screen.findByRole('button', { name: /Dinner starts at seven/ });
    expect(row.textContent).toContain('To Guests who… Is coming · Is in group: Family');
    fireEvent.click(row);
    expect(
      await screen.findByText(/^Worked out at \d\d:\d\d, when it went: 3 guests\.$/u),
    ).toBeTruthy();
  });
});

describe('Write it once (sc-3960)', () => {
  const ADA_PREVIEW = {
    guest: {
      id: 'g_ada',
      name: 'Ada Obi',
      greetAs: 'Auntie Ada',
      language: 'en',
      languageFrom: 'host',
    },
    notices: [
      {
        channel: 'email',
        subject: 'Adaeze and Tunde: a message from Ìrè Events',
        text: 'Dear Auntie Ada,',
      },
    ],
  };

  it('puts a token where Insert is pressed, and Send carries it as a token, not as braces', async () => {
    const sent = onMessages({
      'POST /api/events/ev_1/messages/check': () =>
        json({ people: 2, toldByEmail: 1, cantBeTold: [] }),
      'POST /api/events/ev_1/messages': () => json({ id: 'm_1', queued: { email: 1 } }, 202),
      'GET /api/events/ev_1/messages/m_1': () => json({ message: SENT }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    const field = screen.getByRole('textbox', { name: 'Message' });
    writeMessage(field, 'Dear {name}, ');
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
    const menu = screen.getByRole('menu', { name: 'Insert' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((one) => one.getAttribute('aria-label')),
    ).toEqual(['Greeting', 'Event', 'Date', 'Hosts']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Greeting' }));

    expect(screen.queryByRole('menu')).toBeNull();
    expect(
      within(field).getByRole('img', { name: 'Greeting, filled in for each guest' }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Send to 2 people',
      }),
    );

    await waitFor(() =>
      expect(
        sent.find(({ line }) => line === 'POST /api/events/ev_1/messages')?.body,
      ).toMatchObject({
        message: 'Dear {name}, \uE000greeting\uE001',
      }),
    );
  });

  it('previews as the first guest in To, A to Z, then as another, with the lines that say why', async () => {
    const sent = onMessages({
      'GET /api/events/ev_1/messages/preview/g_ada': () => json(ADA_PREVIEW),
      'GET /api/events/ev_1/messages/preview/g_kwame': () =>
        json({
          guest: {
            id: 'g_kwame',
            name: 'Kwame Mensah',
            greetAs: null,
            language: 'fr',
            languageFrom: 'chose',
          },
          notices: [],
        }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'Bring a {plus one}');
    await previewOn();

    expect(await screen.findByRole('heading', { name: 'As Ada Obi will see it' })).toBeTruthy();
    expect(await screen.findByText('In English, the language you set for them.')).toBeTruthy();
    expect(screen.getByText('Bring a {plus one}', { selector: 'blockquote' })).toBeTruthy();
    expect(
      screen.getByText(
        'Anything you type in braces shows exactly as typed. To fill something in for each guest, use Insert.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Nothing to fill in, so every guest gets exactly these words.'),
    ).toBeTruthy();
    expect(screen.getByText('Adaeze and Tunde: a message from Ìrè Events')).toBeTruthy();
    expect(screen.queryByText(/^Greeted as/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Preview as/ }));
    const options = screen.getAllByRole('option');
    expect(options.map((one) => one.textContent)).toEqual([
      'Ada Obi · English',
      'Kwame Mensah · French',
    ]);
    fireEvent.click(options[1] as HTMLElement);

    expect(
      await screen.findByRole('heading', { name: 'As Kwame Mensah will see it' }),
    ).toBeTruthy();
    expect(
      await screen.findByText('In French, the language they chose on their page.'),
    ).toBeTruthy();
    expect(sent.some(({ line }) => line === 'GET /api/events/ev_1/messages/preview/g_kwame')).toBe(
      true,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('textbox', { name: 'Message' }).textContent).toBe('Bring a {plus one}');
  });

  it('says who the greeting reaches as, and fills it in on their page', async () => {
    onMessages({ 'GET /api/events/ev_1/messages/preview/g_ada': () => json(ADA_PREVIEW) });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    const field = screen.getByRole('textbox', { name: 'Message' });
    writeMessage(field, 'Hello ');
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Greeting' }));
    await previewOn();

    expect(await screen.findByText('Greeted as “Auntie Ada”, their Greet as.')).toBeTruthy();
    expect(screen.getByText('Hello Auntie Ada', { selector: 'blockquote' })).toBeTruthy();
  });

  it('says it could not fill it in for Ada Obi, and Try again fills it in', async () => {
    let tries = 0;
    onMessages({
      'GET /api/events/ev_1/messages/preview/g_ada': () =>
        (tries += 1) === 1 ? json({ error: { code: 'server_error' } }, 500) : json(ADA_PREVIEW),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'Hello');
    await previewOn();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('We could not fill it in for Ada Obi.');
    expect(alert.textContent).toContain('Check your connection and try again.');
    expect(screen.getByRole('heading', { name: 'As Ada Obi will see it' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Preview as/ })).toBeTruthy();

    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('In English, the language you set for them.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(tries).toBe(2);
  });

  it('drops one who is no longer a guest from Preview as, and fills it in for the first left', async () => {
    onMessages({
      'GET /api/events/ev_1/messages/preview/g_ada': () =>
        json({ error: { code: 'not_found' } }, 404),
      'GET /api/events/ev_1/messages/preview/g_kwame': () =>
        json({
          guest: {
            id: 'g_kwame',
            name: 'Kwame Mensah',
            greetAs: null,
            language: 'fr',
            languageFrom: 'chose',
          },
          notices: [],
        }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'Hello');
    await previewOn();

    expect(
      await screen.findByRole('heading', { name: 'As Kwame Mensah will see it' }),
    ).toBeTruthy();
    const line = screen.getByText(
      'Ada Obi is no longer a guest, so it is filled in for Kwame Mensah instead.',
    );
    expect(line.closest('[role=status]')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      await screen.findByText('In French, the language they chose on their page.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Preview as/ }));
    expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual([
      'Kwame Mensah · French',
    ]);
  });

  it('closes the preview when nobody is left, and says why beside Preview', async () => {
    onMessages({
      'GET /api/events/ev_1/messages/guests': () => json({ guests: [GUESTS[1]] }),
      'GET /api/events/ev_1/messages/preview/g_ada': () =>
        json({ error: { code: 'not_found' } }, 404),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'Hello');
    await previewOn();

    expect(
      await screen.findByText('Ada Obi is no longer a guest, so there is nobody to preview it as.'),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /will see it$/ })).toBeNull();
    const preview = screen.getByRole('button', { name: 'Preview' });
    expect(preview.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Message' }).textContent).toBe('Hello');
  });

  it('offers no preview while nobody is in To, and says why', async () => {
    onMessages({ 'GET /api/events/ev_1/messages/guests': () => json({ guests: [] }) });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    const preview = screen.getByRole('button', { name: 'Preview' });
    expect(
      await screen.findByText('No guests chosen yet, so there is nobody to preview it as.'),
    ).toBeTruthy();
    expect(preview.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(preview);
    expect(screen.queryByRole('heading', { name: /will see it$/ })).toBeNull();
  });
});
