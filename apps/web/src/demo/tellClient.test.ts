import { describe, expect, it } from 'vitest';

import {
  ANA,
  EVERY_WAY,
  ORG,
  REACH,
  SIMULATOR,
  TELL_PAGES,
  TELL_NOW,
  TELL_STATES,
  TOLD,
  asBooked,
  cityOf,
  languageName,
  mailtoHref,
  messageOf,
  saidOf,
  tellStart,
  waysOf,
  whatsAppHref,
} from './tellClient.ts';

const say = (
  consultation: Parameters<typeof messageOf>[0],
  language: Parameters<typeof messageOf>[4] = 'en',
  said: Parameters<typeof messageOf>[1] = 'booked',
) => messageOf(consultation, said, ANA.client, ORG, language, TELL_NOW);

describe('the message', () => {
  it('writes the AC’s video call word for word', () => {
    expect(say(TOLD.video).body).toBe(
      'Hello Ana Ferreira, this is Casa Lume, confirming our consultation: Thursday 12 November at 15:00 Lisbon time, for 60 minutes, by video call. The link: https://meet.example.com/abc-defg-hij',
    );
  });

  it('names the place as typed, says only “in person” without one, and calls on the phone', () => {
    expect(say(TOLD.inPerson).body).toContain(
      'in person at Casa Lume, Rua da Rosa 45, 1200-382 Lisboa.',
    );
    expect(say({ ...TOLD.inPerson, where: null }).body).toMatch(/for 60 minutes, in person\.$/u);
    expect(say({ ...TOLD.inPerson, how: 'phone', where: null }).body).toMatch(
      /by phone\. We’ll call you\.$/u,
    );
  });

  it('writes the 15:00 hour plural and the 01:30 hour singular', () => {
    expect(say(TOLD.video, 'pt').body).toContain(
      'quinta-feira, 12 de novembro, às 15:00, hora de Lisboa',
    );
    expect(say(TOLD.paris, 'es').body).toContain(
      'viernes, 13 de noviembre, a la 01:30, hora de París',
    );
    expect(say(TOLD.video, 'es').body).toContain('a las 15:00, hora de Lisboa');
    expect(say(TOLD.video, 'fr').body).toContain('jeudi 12 novembre à 15:00, heure de Lisbonne');
  });

  it('takes the weekday from the consultation’s zone, not the reader’s', () => {
    expect(say(TOLD.paris).body).toContain('Friday 13 November at 01:30 Paris time');
  });

  it('shows the year only when it is not this year', () => {
    expect(say(TOLD.video).body).not.toContain('2026');
    expect(say(TOLD.nextYear).body).toContain('Tuesday, 12 January 2027 at 15:00');
  });

  it('says it changed, or that it is cancelled, with the cancelled subject', () => {
    expect(say(TOLD.video, 'en', 'changed').body).toContain(
      'Our consultation has changed. It is now Thursday 12 November',
    );
    const cancelled = say({ ...TOLD.video, cancelled: true }, 'en', 'cancelled');
    expect(cancelled.body).toBe(
      'Hello Ana Ferreira, this is Casa Lume. Our consultation on Thursday 12 November at 15:00 Lisbon time is cancelled.',
    );
    expect(cancelled.subject).toBe('Consultation cancelled, Thursday 12 November');
    expect(say(TOLD.video).subject).toBe('Consultation with Casa Lume, Thursday 12 November');
  });

  it('holds nothing else: no notes, member, link to Soirely, emoji or em dash', () => {
    for (const state of TELL_STATES) {
      const start = tellStart(state);
      for (const one of start.list) {
        for (const language of ['en', 'es', 'fr', 'pt'] as const) {
          const { body, subject } = messageOf(one, 'booked', ANA.client, ORG, language, TELL_NOW);
          const all = `${body} ${subject}`;
          expect(all).not.toMatch(
            /—|Soirely|Folake|Kemi|Tunde|Sintra, about|\p{Extended_Pictographic}/u,
          );
        }
      }
    }
  });
});

describe('which message is offered', () => {
  it('booked, changed, cancelled ahead, and nothing once started', () => {
    expect(saidOf(TOLD.video, asBooked(TOLD.video), TELL_NOW)).toBe('booked');
    expect(saidOf(TOLD.video, { ...asBooked(TOLD.video), minutes: 30 }, TELL_NOW)).toBe('changed');
    expect(saidOf({ ...TOLD.video, cancelled: true }, asBooked(TOLD.video), TELL_NOW)).toBe(
      'cancelled',
    );
    expect(saidOf(TOLD.held, asBooked(TOLD.held), TELL_NOW)).toBeNull();
    expect(saidOf(TOLD.cancelledPast, asBooked(TOLD.cancelledPast), TELL_NOW)).toBeNull();
  });

  it('ignores Led by', () => {
    expect(saidOf({ ...TOLD.video, ledBy: 'kemi' }, asBooked(TOLD.video), TELL_NOW)).toBe('booked');
  });
});

describe('the ways', () => {
  it('puts the best way first, and drops a way that is not offered', () => {
    expect(waysOf(REACH, EVERY_WAY)).toEqual(['whatsApp', 'email', 'copy']);
    expect(waysOf({ ...REACH, best: 'email' }, EVERY_WAY)).toEqual(['email', 'whatsApp', 'copy']);
    expect(waysOf({ ...REACH, best: 'textMessage' }, EVERY_WAY)).toEqual([
      'copy',
      'whatsApp',
      'email',
    ]);
    expect(waysOf({ ...REACH, best: 'phoneCall' }, EVERY_WAY)).toEqual([
      'whatsApp',
      'email',
      'copy',
    ]);
    expect(waysOf({ ...REACH, best: null }, EVERY_WAY)).toEqual(['whatsApp', 'email', 'copy']);
    expect(waysOf({ ...REACH, email: null }, EVERY_WAY)).toEqual(['whatsApp', 'copy']);
    expect(waysOf({ ...REACH, phone: null, best: 'textMessage' }, EVERY_WAY)).toEqual([
      'copy',
      'email',
    ]);
    expect(waysOf(REACH, SIMULATOR)).toEqual(['copy']);
  });
});

describe('the addresses', () => {
  it('opens WhatsApp on the device with the digits, never wa.me', () => {
    expect(whatsAppHref('+351 912 345 678', 'Olá às 15:00')).toBe(
      'whatsapp://send?phone=351912345678&text=Ol%C3%A1%20%C3%A0s%2015%3A00',
    );
  });

  it('writes mailto: per RFC 6068', () => {
    expect(mailtoHref('ana.ferreira@example.pt', 'A & B', 'x=1?')).toBe(
      'mailto:ana.ferreira@example.pt?subject=A%20%26%20B&body=x%3D1%3F',
    );
  });
});

describe('names', () => {
  it('names each language in its own words, and a city by the table or its zone', () => {
    expect(['en', 'es', 'fr', 'pt'].map((one) => languageName(one as 'en'))).toEqual([
      'English',
      'Español',
      'Français',
      'Português',
    ]);
    expect(cityOf('America/New_York', 'pt')).toBe('Nova Iorque');
    expect(cityOf('America/Sao_Paulo', 'en')).toBe('São Paulo');
    expect(cityOf('America/Argentina/Buenos_Aires', 'fr')).toBe('Buenos Aires');
  });

  it('links every state but the iOS simulator’s', () => {
    const linked = TELL_PAGES.flatMap((page) => page.states.map((one) => one.to.split('=')[1]));
    expect(linked.sort()).toEqual(TELL_STATES.filter((one) => one !== 'app-simulator').sort());
  });
});
