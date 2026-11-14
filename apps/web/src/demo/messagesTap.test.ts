import { describe, expect, it } from 'vitest';

import { HOST_NAMES, countsOf, messagesStateOf, sectionsOf, seedOf } from './messages.ts';
import { GROUPS } from './messagesTo.ts';
import {
  TAP_STATES,
  notSentBit,
  receiptBit,
  tapCaseOf,
  tapLine,
  tapMessage,
} from './messagesTap.ts';

function seeded(state: string) {
  return seedOf(messagesStateOf(state));
}

describe('a guest’s tap on the WhatsApp invitation (sc-46343)', () => {
  it('opens every tap state on a guest’s conversation', () => {
    for (const { key } of TAP_STATES) {
      const inbox = seeded(key);

      expect(inbox.tap).toBeDefined();
      expect(inbox.pane).toEqual({ kind: 'convo', id: inbox.tap?.id });
    }
  });

  it('says what was recorded, or that nothing changed', () => {
    expect(tapLine({ answer: 'notComing', kind: 'recorded', at: '08:20' }, 'Kwame Mensah')).toBe(
      'Kwame Mensah answered Not coming by WhatsApp.',
    );
    expect(tapLine({ answer: 'notSure', kind: 'coming', at: '08:20' }, 'Kwame Mensah')).toBe(
      'Kwame Mensah tapped Not sure yet in WhatsApp. Nothing changed.',
    );
  });

  it('writes Soirely’s message in the guest’s language, the companions line in the middle', () => {
    expect(
      tapMessage(
        { answer: 'notSure', kind: 'recorded', at: '08:20', companions: true },
        'es',
        HOST_NAMES,
      ),
    ).toEqual([
      'Gracias. Hemos avisado a Adaeze Obi y Tunde Bakare de que aún no lo sabe.',
      'Sus acompañantes quedan en espera hasta que usted decida.',
      'Si cambia de opinión, los botones de la invitación siguen funcionando.',
    ]);
    expect(
      tapMessage({ answer: 'notSure', kind: 'repeat', at: '08:31' }, 'en', HOST_NAMES),
    ).toEqual(['You’re already down as Not sure yet. Nothing has changed.']);
    expect(
      tapMessage({ answer: 'notSure', kind: 'closed', at: '08:20' }, 'en', HOST_NAMES),
    ).toEqual(['Answers closed on 2 November 2026. Contact your host if something has changed.']);
  });

  it('joins any number of hosts in the guest’s language', () => {
    expect(
      tapMessage({ answer: 'notComing', kind: 'recorded', at: '08:20' }, 'es', [
        'Adaeze Obi',
        'Tunde Bakare',
        'Kemi Ade',
      ])[0],
    ).toBe('Gracias. Hemos avisado a Adaeze Obi, Tunde Bakare y Kemi Ade de que no viene.');
  });

  it('draws Read as delivered, and nothing sent with its own mark', () => {
    expect(receiptBit('read')).toEqual({ words: 'WhatsApp · Read', mark: 'delivered' });
    expect(receiptBit('failed')).toEqual({ words: 'WhatsApp · Failed', mark: 'bounced' });
    expect(notSentBit('credits')).toEqual({
      words: 'Not sent · Not enough credits',
      mark: 'notsent',
    });
    expect(notSentBit('stopped')).toEqual({ words: 'Not sent · Stopped WhatsApp', mark: 'optout' });
  });

  it('keeps each conversation in its section, with the tap as its row line', () => {
    const kwame = sectionsOf(seeded('tapNotComing'), GROUPS);
    const lucia = sectionsOf(seeded('tapNeedsYou'), GROUPS);

    expect(kwame.done.find((row) => row.id === 'kwame')).toMatchObject({
      line: 'Kwame Mensah answered Not coming by WhatsApp.',
      when: '08:20',
    });
    expect(lucia.needs.find((row) => row.id === 'lucia')?.line).toBe(
      'Lucía Ortega answered Not sure yet by WhatsApp.',
    );
  });

  it('starts a conversation in Done, first and not unread, for a guest who had written nothing', () => {
    const before = seedOf(null);
    const inbox = seeded('tapFirst');
    const sections = sectionsOf(inbox, GROUPS);

    expect(sections.needs.find((row) => row.id === 'valentina')).toBeUndefined();
    expect(sections.done[0]).toMatchObject({
      id: 'valentina',
      line: 'Valentina Restrepo answered Not coming by WhatsApp.',
      when: '08:20',
      lead: { kind: 'guest', unread: false },
    });
    expect(inbox.doneAt.valentina).toBeUndefined();
    expect(countsOf(inbox)).toEqual(countsOf(before));
  });

  it('adds nothing for a further repeat', () => {
    expect(tapCaseOf('tapRepeatAgain')).toEqual(tapCaseOf('tapRepeat'));
  });
});
