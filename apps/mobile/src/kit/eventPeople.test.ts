import { ApiError, type EventPerson, type EventRole } from '@soirely/api-client';
import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';

import {
  addRefused,
  holderOf,
  cardFacts,
  cardWords,
  firstNameOf,
  inListOrder,
  managesPeople,
  nowCan,
  offerLine,
  offered,
  opensRow,
  outsideView,
  personShown,
  readTyped,
  rowLine,
  seesEveryEvent,
} from './eventPeople.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

function person(id: string, name: string, role: EventRole, jobLabel: string | null = null) {
  return {
    id,
    membershipId: `m_${id}`,
    user: { id: `u_${id}`, name },
    role,
    jobLabel,
    outside: false,
    address: null,
    addressKind: null,
    endsAt: null,
    doorCode: null,
    joinedAt: null,
  } satisfies EventPerson;
}

function fromOutside(
  id: string,
  address: string | null,
  addressKind: 'email' | 'mobile' | null,
): EventPerson {
  return {
    id,
    membershipId: null,
    user: null,
    role: 'can_check_in',
    jobLabel: 'Lighting',
    outside: true,
    address,
    addressKind,
    endsAt: '2026-12-12T23:00:00+01:00',
    doorCode: null,
    joinedAt: null,
  };
}

const PRIYA = person('priya', 'Priya Shah', 'lead');
const TOM = person('tom', 'Tom Becker', 'can_check_in', 'Door');
const ANA = person('ana', 'Ana Souza', 'can_edit');
const BEN = person('ben', 'Ben Adler', 'can_check_in');

describe('People on an event', () => {
  it('runs by role, Lead first, then by name', () => {
    expect(inListOrder([TOM, BEN, ANA, PRIYA], 'en').map((one) => one.id)).toEqual([
      'priya',
      'ana',
      'ben',
      'tom',
    ]);
  });

  it('lists the service levels after the event roles, and names them (sc-4002)', () => {
    const waiter = { ...person('kemi', 'Kemi Okafor', 'can_work_floor'), outside: true };
    const runner = { ...person('ade', 'Ade Bello', 'can_run_floor'), outside: true };

    expect(inListOrder([runner, waiter, TOM], 'en').map((one) => one.id)).toEqual([
      'tom',
      'kemi',
      'ade',
    ]);
    expect(rowLine(t, waiter, 'u_priya')).toBe('Can work the floor');
  });

  it('is changed by whoever the event gives people.manage', () => {
    expect(managesPeople({ permissions: ['events.read', 'people.manage'] })).toBe(true);
    expect(managesPeople({ permissions: ['events.read'] })).toBe(false);
  });

  it('opens every row but your own, and none without people.manage', () => {
    expect(opensRow(TOM.user.id, true, 'u_priya')).toBe(true);
    expect(opensRow(PRIYA.user.id, true, 'u_priya')).toBe(false);
    expect(opensRow(TOM.user.id, false, 'u_priya')).toBe(false);
  });

  it('lines a row with its role, then any job label, then You', () => {
    expect(rowLine(t, TOM, 'u_priya')).toBe('Can check guests in · Door');
    expect(rowLine(t, PRIYA, 'u_priya')).toBe('Lead · You');
  });

  it('ends the line of someone who came in by a door code with Door code', () => {
    const joined = { ...TOM, doorCode: 'K7P2QX9M', joinedAt: '2026-11-14T13:31:00+00:00' };

    expect(rowLine(t, joined, 'u_priya')).toBe('Can check guests in · Door · Door code');
  });

  it('names the owners and admins who see every event', () => {
    expect(
      seesEveryEvent(
        t,
        { owners: ['Folake Adeyemi'], admins: ['Julien Morel'] },
        'Ire Events',
        'en',
      ),
    ).toBe('Folake Adeyemi and Julien Morel see every event, as owner and admin of Ire Events.');
    expect(seesEveryEvent(t, { owners: ['Folake Adeyemi'], admins: [] }, 'Ire Events', 'en')).toBe(
      'Folake Adeyemi sees every event, as owner of Ire Events.',
    );
    expect(seesEveryEvent(t, { owners: [], admins: [] }, 'Ire Events', 'en')).toBeNull();
  });

  it('says who was added, and how many when several were', () => {
    expect(nowCan(t, 'can_view', ['Kofi Mensah'])).toBe('Kofi Mensah can view now.');
    expect(nowCan(t, 'can_view', ['A', 'B', 'C'])).toBe('3 people can view now.');
  });

  it('finds members by name, ignoring accents and case', () => {
    const addable = [
      { membershipId: 'm1', name: 'Lucía Pérez', role: 'member' },
      { membershipId: 'm2', name: 'Kofi Mensah', role: 'member' },
    ];

    expect(offered(addable, 'lucia').map((one) => one.membershipId)).toEqual(['m1']);
    expect(offered(addable, '  ')).toHaveLength(2);
    expect(offered(addable, 'zed')).toEqual([]);
  });

  it('offers members before the owners and admins, each with their role', () => {
    const addable = [
      { membershipId: 'm1', name: 'Folake Adeyemi', role: 'owner' },
      { membershipId: 'm2', name: 'Julien Moreau', role: 'administrator' },
      { membershipId: 'm3', name: 'Kofi Mensah', role: 'member' },
    ];
    const shown = offered(addable, '');

    expect(shown.map((one) => one.membershipId)).toEqual(['m3', 'm1', 'm2']);
    expect(shown.map((one) => offerLine(t, one))).toEqual([
      'Member',
      'Owner · sees every event',
      'Admin · sees every event',
    ]);
    expect(offerLine(t, { membershipId: 'm4', name: 'Ada', role: null })).toBeUndefined();
  });
});

describe('Add people, part way', () => {
  const refused = (() => {
    const problem = {
      type: 'https://soirely.com/errors/validation_failed',
      title: 'Some of the information provided is not valid.',
      status: 422,
      violations: [
        { propertyPath: 'membershipId', message: 'Ana Souza is not an active member.', code: 'x' },
      ],
    };

    return new ApiError(problem, new Response(JSON.stringify(problem), { status: 422 }));
  })();

  it('names who went in, then the refusal', () => {
    expect(addRefused(t, refused, 'can_view', ['Kofi Mensah'], ['Ana Souza', 'Tom Becker'])).toBe(
      'Kofi Mensah can view now. Ana Souza is not an active member.',
    );
  });

  it('names who is still ticked when nothing answered', () => {
    const offline = new Error('offline');

    expect(addRefused(t, offline, 'can_view', [], ['Tom Becker'])).toBe(
      'We couldn’t add Tom Becker, so they’re still ticked. Check your connection and press Add again.',
    );
    expect(addRefused(t, offline, 'lead', ['A', 'B'], ['C', 'D', 'E'])).toBe(
      '2 people lead this event now. We couldn’t add the 3 still ticked. Check your connection and press Add again.',
    );
  });
});

describe('Someone from outside the organisation', () => {
  const BISI = fromOutside('bisi', 'Bisi@LagosLights.example', 'email');
  const PHONE = fromOutside('phone', '+2348035550142', 'mobile');
  const WITHHELD = fromOutside('withheld', null, null);

  it('reads an @ as an email address, and checks its shape', () => {
    expect(readTyped('bisi@lagoslights.example', 'NG')).toEqual({
      kind: 'address',
      address: {
        kind: 'email',
        address: 'bisi@lagoslights.example',
        shown: 'bisi@lagoslights.example',
      },
    });
    expect(readTyped('bisi@lagos', 'NG')).toEqual({ kind: 'unusable' });
  });

  it('reads digits as a mobile number in the organisation’s country, or by its own + code', () => {
    expect(readTyped('0803 555 0142', 'NG')).toEqual({
      kind: 'address',
      address: { kind: 'mobile', address: '+2348035550142', shown: '+234 803 555 0142' },
    });
    expect(readTyped('+351 912 345 412', 'NG')).toMatchObject({
      address: { address: '+351912345412' },
    });
    expect(readTyped('0803 555', 'NG')).toEqual({ kind: 'unusable' });
    expect(readTyped('Kofi', 'NG')).toEqual({ kind: 'name' });
    expect(readTyped('  ', 'NG')).toEqual({ kind: 'name' });
  });

  it('offers the address, refuses Lead, and names who holds it already', () => {
    const nobody = () => null;

    expect(outsideView('bisi@lagoslights.example', 'NG', false, nobody).kind).toBe('offer');
    expect(outsideView('bisi@lagoslights.example', 'NG', true, nobody).kind).toBe('leadOff');
    expect(outsideView('bisi@lagos', 'NG', false, nobody).kind).toBe('unusable');
    expect(outsideView('Kofi', 'NG', false, nobody).kind).toBe('none');
    expect(outsideView('BISI@lagoslights.example', 'NG', false, () => 'Bisi')).toEqual({
      kind: 'onEvent',
      name: 'Bisi',
    });
  });

  it('finds an address on the event ignoring case, and a number in E.164', () => {
    const people = [PRIYA, BISI, PHONE, WITHHELD];
    const email = readTyped('bisi@lagoslights.EXAMPLE', 'NG');
    const mobile = readTyped('0803 555 0142', 'NG');
    if (email.kind !== 'address' || mobile.kind !== 'address') throw new Error('Both read.');

    expect(holderOf(people, email.address, 'Not joined yet')).toBe('Bisi@LagosLights.example');
    expect(holderOf(people, mobile.address, 'Not joined yet')).toBe('+234 803 555 0142');
    expect(
      holderOf([PRIYA], { kind: 'email', address: 'x@y.example', shown: 'x@y.example' }, ''),
    ).toBeNull();
  });

  it('shows the address with its mark until they join, else Not joined yet', () => {
    expect(personShown(BISI)).toEqual({
      kind: 'address',
      name: 'Bisi@LagosLights.example',
      mark: 'mail',
    });
    expect(personShown(PHONE)).toEqual({
      kind: 'address',
      name: '+234 803 555 0142',
      mark: 'phone',
    });
    expect(personShown(WITHHELD)).toEqual({ kind: 'notJoined' });
    expect(personShown(PRIYA)).toEqual({ kind: 'named', name: 'Priya Shah', userId: 'u_priya' });
  });

  it('cuts only an account name to its first word, never an address or a number (sc-91678)', () => {
    expect(firstNameOf(PRIYA)).toBe('Priya');
    expect(firstNameOf(BISI)).toBeNull();
    expect(firstNameOf(PHONE)).toBeNull();
    expect(firstNameOf(WITHHELD)).toBeNull();
  });

  it('opens a row with no account yet, and lines it with role and job label', () => {
    expect(opensRow(null, true, 'u_priya')).toBe(true);
    expect(rowLine(t, WITHHELD, 'u_priya')).toBe('Can check guests in · Lighting');
  });
});

describe("Overview's People card", () => {
  it('counts everyone People lists and names the Lead', () => {
    const words = cardWords(
      t,
      cardFacts([TOM, PRIYA, ANA, BEN, person('jo', 'Jo Lin', 'can_view')], 'u_tom'),
    );

    expect(words).toEqual({
      title: '5 on this event',
      line: 'Lead · Priya Shah',
      label: '5 on this event. Lead, Priya Shah. Opens People.',
    });
  });

  it('says You when the viewer holds Lead', () => {
    expect(cardWords(t, cardFacts([PRIYA], 'u_priya')).line).toBe('Lead · You');
  });

  it('has no Lead line when nobody holds Lead', () => {
    expect(cardWords(t, cardFacts([TOM, ANA], 'u_tom'))).toEqual({
      title: '2 on this event',
      line: undefined,
      label: '2 on this event. Opens People.',
    });
  });

  it('says nobody is on it, and still opens People', () => {
    expect(cardWords(t, cardFacts([], 'u_tom'))).toEqual({
      title: 'Nobody is on this event yet.',
      line: undefined,
      label: 'Nobody is on this event yet. Opens People.',
    });
  });
});
