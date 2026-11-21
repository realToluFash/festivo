import { describe, expect, it } from 'vitest';

import { figuresOf } from './messages.ts';
import {
  CHOOSE_STATES,
  PROVIDER_BLOCKED,
  choseAudience,
  chooseSeedOf,
  idOf,
  matching,
  pickable,
} from './messagesChoose.ts';
import { chipWords, countOf, BOOK } from './messagesTo.ts';
import { choseNobody } from './messagesRefusals.ts';

const TICKS = { email: true, sms: false, whatsApp: false };

describe('Choose guests, one by one (sc-3942)', () => {
  it('lists the 142 guests A to Z, each once', () => {
    const names = pickable().map((one) => one.name);

    expect(names).toHaveLength(142);
    expect(new Set(pickable().map((one) => one.id)).size).toBe(142);
    expect(names.slice(0, 2)).toEqual(['Abena Mensah', 'Adwoa Adebayo']);
  });

  it('flags no address, a bouncing address and a spam report, and never a provider block', () => {
    const flag = (name: string) => pickable().find((one) => one.name === name)?.flag;

    expect(flag('Dayo Gomez')).toBe('noAddress');
    expect(flag('Dayo Amoah')).toBe('bouncing');
    expect(flag('Diego Amoah')).toBe('complained');
    expect(flag(PROVIDER_BLOCKED)).toBeNull();
    expect(pickable().find((one) => one.name === 'Dayo Gomez')?.email).toBeNull();
  });

  it('finds any part of a name, ignoring case and accents, and an address only with guests.manage', () => {
    expect(matching('LUCIA', true).map((one) => one.name)).toContain('Lucía Ortega');
    expect(matching('ade', true).every((one) => /ade/iu.test(one.name + (one.email ?? '')))).toBe(
      true,
    );
    expect(matching('gmial', true).map((one) => one.name)).toEqual(['Ama Diallo', 'Dayo Amoah']);
    expect(matching('gmial', false)).toHaveLength(0);
    expect(matching('Zainab', true)).toHaveLength(0);
    expect(matching('  ', true)).toHaveLength(142);
  });

  it('counts the chosen, names them on the chip, and refuses nobody', () => {
    const three = choseAudience(['Abena Mensah', 'Adwoa Rossi', 'Ama Owusu'].map(idOf));

    expect(countOf(three, BOOK.groups)).toBe(3);
    expect(chipWords(three, BOOK)).toBe('Choose guests · 3');
    expect(chipWords(choseAudience([]), BOOK)).toBe('Choose guests');
    expect(choseNobody(choseAudience([]))).toBe(true);
    expect(choseNobody(three)).toBe(false);
  });

  it('tells email to the unflagged chosen only, and names the rest with why', () => {
    const chosen = choseAudience(['Abena Mensah', 'Dayo Amoah', 'Dayo Gomez'].map(idOf));
    const figures = figuresOf(chosen, TICKS);

    expect(figures.counts.email).toBe(1);
    expect(figures.names.map((one) => one.name)).toEqual(['Dayo Amoah', 'Dayo Gomez']);
    expect(figures.names[0]?.why).toContain('Address is bouncing');
    expect(figures.names[1]?.why).toContain('No email address');
  });

  it('seeds every state with guests that exist', () => {
    for (const { key } of CHOOSE_STATES) {
      const seed = chooseSeedOf(key);

      expect(seed.chosen.every((id) => id !== '')).toBe(true);
    }
    expect(chooseSeedOf('chosenMany').chosen).toHaveLength(9);
    expect(chooseSeedOf('chosen').open).toBe(false);
  });
});
