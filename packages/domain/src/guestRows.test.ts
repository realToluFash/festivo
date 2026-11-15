import { ApiError, type Guest } from '@soirely/api-client';
import { peopleOf } from './guestView.ts';
import { describe, expect, it } from 'vitest';

import {
  companionShown,
  contactOf,
  invitationLine,
  repliedRefusal,
  rowWords,
} from './guestRows.ts';

const t = (key: string, values?: Record<string, unknown>) =>
  values == null ? key : `${key}${JSON.stringify(values)}`;

function guest(more: Partial<Guest> = {}): Guest {
  return {
    id: 'g1',
    fullName: 'Adaeze Okafor',
    group: null,
    email: null,
    mobile: null,
    language: null,
    chosenLanguage: null,
    messageLanguage: null,
    reply: 'noReply',
    repliedAt: null,
    invitation: { at: '2026-11-01T10:00:00+01:00', how: 'whatsapp', by: null },
    companions: [],
    ...more,
  };
}

describe('the app guest rows', () => {
  it('numbers a blank companion from the second blank one', () => {
    expect(companionShown(t, 'Ada', [null, 'Bo', null], 0)).toBe('guestList.guestOf{"host":"Ada"}');
    expect(companionShown(t, 'Ada', [null, 'Bo', null], 1)).toBe('Bo');
    expect(companionShown(t, 'Ada', [null, 'Bo', null], 2)).toBe(
      'guestList.guestOfNth{"host":"Ada","nth":2}',
    );
  });

  it('shows no contact to a reader the API sent none', () => {
    expect(contactOf(t, guest())).toBeNull();
    expect(contactOf(t, guest({ email: 'ada@example.com' }))).toBe('ada@example.com');
  });

  it('says a guest with no reply and no contact by their reply alone', () => {
    const [person] = peopleOf([guest()]);

    expect(
      rowWords(t, person!, false, 'Europe/London', 'en-GB', { places: 'named', contact: true }),
    ).toEqual({
      name: 'Adaeze Okafor',
      line: 'guestList.reply.noReply',
    });
  });

  it('says a guest nobody has invited is Not yet invited', () => {
    const [person] = peopleOf([guest({ invitation: null })]);

    expect(
      rowWords(t, person!, false, 'Europe/London', 'en-GB', { places: 'named', contact: true })
        .line,
    ).toBe('guestList.reply.notYetInvited');
  });

  it("says a guest's places beside the reply, unless the places are not shown", () => {
    const [person] = peopleOf([
      guest({
        companions: [
          { id: 'c1', fullName: 'Bo', state: 'coming', namedByGuest: false },
          { id: 'c2', fullName: null, state: 'held', namedByGuest: false },
        ],
      }),
    ]);
    const places =
      'guestList.withPlaces{"reply":"guestList.reply.noReply","places":"guestList.companionsNamed{\\"count\\":2,\\"named\\":1}"}';

    expect(
      rowWords(t, person!, false, 'Europe/London', 'en-GB', { places: 'named', contact: true })
        .line,
    ).toBe(places);
    expect(
      rowWords(t, person!, false, 'Europe/London', 'en-GB', { places: null, contact: true }).line,
    ).toBe('guestList.reply.noReply');
  });

  it("counts a guest's companions alone and leaves out the contact, as the app's row says them", () => {
    const [person] = peopleOf([
      guest({
        email: 'ada@example.com',
        companions: [{ id: 'c1', fullName: 'Bo', state: 'coming', namedByGuest: false }],
      }),
    ]);

    expect(
      rowWords(t, person!, false, 'Europe/London', 'en-GB', { places: 'counted', contact: false })
        .line,
    ).toBe(
      'guestList.withPlaces{"reply":"guestList.reply.noReply","places":"guestList.countCompanions{\\"count\\":1}"}',
    );
  });

  it('says how a guest was invited in place of the reply, and the reply when there is no such line', () => {
    const [person] = peopleOf([guest()]);
    const invited = 'Invited by Folake Adeyemi, WhatsApp, Oct 9';

    const noReply = { places: null, contact: true };

    expect(
      rowWords(t, person!, false, 'Europe/London', 'en-GB', { ...noReply, invitation: invited })
        .line,
    ).toBe(invited);
    expect(
      rowWords(t, person!, false, 'Europe/London', 'en-GB', { ...noReply, invitation: null }).line,
    ).toBe('guestList.reply.noReply');
  });

  it('says a held companion is held, under their host', () => {
    const people = peopleOf([
      guest({ companions: [{ id: 'c1', fullName: null, state: 'held', namedByGuest: false }] }),
    ]);

    expect(
      rowWords(t, people[1]!, true, 'Europe/London', 'en-GB', { places: 'named', contact: true }),
    ).toEqual({
      name: 'guestList.guestOf{"host":"Adaeze Okafor"}',
      line: 'guestList.heldLine',
    });
  });
});

describe("the app row's group (sc-5519)", () => {
  const EN: Record<string, string> = {
    'guestList.reply.coming': 'Coming',
    'guestList.replied': '{reply} · replied {date}',
    'guestList.withGroup': '{reply} · {group}',
    'guestList.withPlaces': '{reply} · {places}',
    'guestList.countCompanions': '{count} companion',
  };
  const en = (key: string, values: Record<string, string | number> = {}) =>
    (EN[key] ?? key).replaceAll(/\{(\w+)\}/gu, (_, name: string) => String(values[name]));
  const counted = { places: 'counted', contact: false } as const;
  const bride = guest({
    reply: 'coming',
    repliedAt: '2026-10-14T12:00:00+01:00',
    group: { id: 'gr_bride', name: 'Bride’s side' },
    companions: [{ id: 'c1', fullName: 'Bo', state: 'coming', namedByGuest: false }],
  });

  it('says the group after the reply and before the places', () => {
    const [person] = peopleOf([bride]);

    expect(
      rowWords(en, person!, false, 'Europe/London', 'en-GB', { ...counted, group: true }).line,
    ).toBe('Coming · replied 14 Oct · Bride’s side · 1 companion');
  });

  it("gives a companion their host's group", () => {
    const people = peopleOf([bride]);

    expect(
      rowWords(en, people[1]!, true, 'Europe/London', 'en-GB', { ...counted, group: true }).line,
    ).toBe('Coming · Bride’s side');
  });

  it('says nothing more of a guest in no group', () => {
    const [person] = peopleOf([guest({ ...bride, group: null })]);

    expect(
      rowWords(en, person!, false, 'Europe/London', 'en-GB', { ...counted, group: true }).line,
    ).toBe('Coming · replied 14 Oct · 1 companion');
  });

  it('leaves the group out of a row that does not ask for it, as the web’s', () => {
    const people = peopleOf([bride]);

    expect(rowWords(en, people[0]!, false, 'Europe/London', 'en-GB', counted).line).toBe(
      'Coming · replied 14 Oct · 1 companion',
    );
    expect(rowWords(en, people[1]!, true, 'Europe/London', 'en-GB', counted).line).toBe('Coming');
  });
});

describe('the people of a guest list', () => {
  it('sorts a list once, and a new list again', () => {
    const list = [guest({ id: 'g2', fullName: 'Émile Bassey' }), guest()];
    const first = peopleOf(list);

    expect(first.map((one) => one.id)).toEqual(['g1', 'g2']);
    expect(peopleOf(list)).toBe(first);
    expect(peopleOf([...list])).not.toBe(first);
  });
});

describe('the Invitation line', () => {
  const at = '2026-11-03T10:00:00+00:00';
  const line = (invitation: Guest['invitation']) =>
    invitationLine(t, { invitation }, 'Europe/London', 'en-GB');

  it('names who marked them by hand, how and when', () => {
    expect(line({ at, how: 'whatsapp', by: 'Folake Adeyemi' })).toBe(
      'guestList.invitedBy{"name":"Folake Adeyemi","how":"guestList.howMid.whatsapp","date":"3 Nov"}',
    );
  });

  it('leaves the name out once their account is gone', () => {
    expect(line({ at, how: 'email', by: null })).toBe(
      'guestList.invitedHow{"how":"guestList.howMid.email","date":"3 Nov"}',
    );
  });

  it('says Soirely’s message, or that they replied, with no name', () => {
    expect(line({ at, how: 'soirelyMessage', by: null })).toBe(
      'guestList.invitedByMessage{"date":"3 Nov"}',
    );
    expect(line({ at, how: 'reply', by: null })).toBe(
      'guestList.invitedWhenReplied{"date":"3 Nov"}',
    );
  });

  it('is null while nobody has invited them', () => {
    expect(line(null)).toBeNull();
  });
});

describe('repliedRefusal', () => {
  const refused = (code: string, more: Record<string, string> = {}) => {
    const problem = {
      type: `https://soirely.com/errors/${code}`,
      title: code,
      status: 409,
      ...more,
    };
    return new ApiError(problem, new Response(JSON.stringify(problem), { status: 409 }));
  };

  it('names the reply and when it came', () => {
    expect(
      repliedRefusal(
        refused('guest_replied', { reply: 'maybe', repliedAt: '2026-11-02T10:00:00+01:00' }),
      ),
    ).toEqual({ reply: 'maybe', at: '2026-11-02T10:00:00+01:00' });
  });

  it('is nothing without a known reply and its date, or for another refusal', () => {
    expect(
      repliedRefusal(refused('guest_replied', { reply: 'noReply', repliedAt: '2026-11-02' })),
    ).toBeNull();
    expect(repliedRefusal(refused('guest_replied', { reply: 'coming' }))).toBeNull();
    expect(
      repliedRefusal(refused('not_found', { reply: 'coming', repliedAt: '2026-11-02' })),
    ).toBeNull();
    expect(repliedRefusal(new Error('offline'))).toBeNull();
  });
});
