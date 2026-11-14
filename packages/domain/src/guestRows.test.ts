import type { Guest } from '@soirely/api-client';
import { peopleOf } from './guestView.ts';
import { describe, expect, it } from 'vitest';

import { companionShown, contactOf, invitationLine, rowWords } from './guestRows.ts';

const t = (key: string, values?: Record<string, unknown>) =>
  values == null ? key : `${key}${JSON.stringify(values)}`;

function guest(more: Partial<Guest> = {}): Guest {
  return {
    id: 'g1',
    fullName: 'Adaeze Okafor',
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

    expect(rowWords(t, person!, false, 'Europe/London', 'en-GB', true)).toEqual({
      name: 'Adaeze Okafor',
      line: 'guestList.reply.noReply',
    });
  });

  it('says a guest nobody has invited is Not yet invited', () => {
    const [person] = peopleOf([guest({ invitation: null })]);

    expect(rowWords(t, person!, false, 'Europe/London', 'en-GB', true).line).toBe(
      'guestList.reply.notYetInvited',
    );
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

    expect(rowWords(t, person!, false, 'Europe/London', 'en-GB', true).line).toBe(places);
    expect(rowWords(t, person!, false, 'Europe/London', 'en-GB', false).line).toBe(
      'guestList.reply.noReply',
    );
  });

  it('says how a guest was invited in place of the reply when the places are not shown, and the reply when there is no such line', () => {
    const [person] = peopleOf([guest()]);
    const invited = 'Invited by Folake Adeyemi, WhatsApp, Oct 9';

    expect(rowWords(t, person!, false, 'Europe/London', 'en-GB', false, invited).line).toBe(
      invited,
    );
    expect(rowWords(t, person!, false, 'Europe/London', 'en-GB', false, null).line).toBe(
      'guestList.reply.noReply',
    );
    expect(rowWords(t, person!, false, 'Europe/London', 'en-GB', true, invited).line).toBe(
      'guestList.reply.noReply',
    );
  });

  it('says a held companion is held, under their host', () => {
    const people = peopleOf([
      guest({ companions: [{ id: 'c1', fullName: null, state: 'held', namedByGuest: false }] }),
    ]);

    expect(rowWords(t, people[1]!, true, 'Europe/London', 'en-GB', true)).toEqual({
      name: 'guestList.guestOf{"host":"Adaeze Okafor"}',
      line: 'guestList.heldLine',
    });
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
