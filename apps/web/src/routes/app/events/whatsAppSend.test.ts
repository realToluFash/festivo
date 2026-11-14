import { afterEach, describe, expect, it } from 'vitest';

import { keepAsked, keptAsked, whatsAppHref, whatsAppMessage } from './whatsAppSend.ts';

const EVENT = {
  name: 'Adaeze and Tunde',
  hosts: ['Amara Okafor', 'Tomi Bello'],
  startsAt: '2030-11-14T23:30:00+01:00',
  timeZone: 'Africa/Lagos',
};
const LINK = 'https://app.soirely.test/i/goJP8j72G8dKsdGysCtB7qA4o2SdVzDrjFodz60tDDc';

function guestIn(messageLanguage: string | null, organisationLanguage: string | null = 'en') {
  return {
    fullName: 'Yusuf Ibrahim',
    mobile: '+2348035550142',
    messageLanguage,
    organisationLanguage,
  };
}

afterEach(() => {
  sessionStorage.clear();
});

describe('The invitation Send on WhatsApp writes (sc-26025)', () => {
  it('greets by the full name as typed, and joins the hosts and writes the date in the guest’s language', () => {
    expect(whatsAppMessage(guestIn('en'), EVENT, LINK)).toBe(
      `Yusuf Ibrahim, Amara Okafor and Tomi Bello would love you to come to Adaeze and Tunde on 14 November 2030. Your own page, to reply and see the details: ${LINK}`,
    );
    expect(whatsAppMessage(guestIn('es'), EVENT, LINK)).toContain(
      'Amara Okafor y Tomi Bello',
    );
    expect(whatsAppMessage(guestIn('es'), EVENT, LINK)).toContain('14 de noviembre de 2030');
    expect(whatsAppMessage(guestIn('fr'), EVENT, LINK)).toContain('Amara Okafor et Tomi Bello');
    expect(whatsAppMessage(guestIn('fr'), EVENT, LINK)).toContain('14 novembre 2030');
    expect(whatsAppMessage(guestIn('pt'), EVENT, LINK)).toContain('Amara Okafor e Tomi Bello');
    expect(whatsAppMessage(guestIn('pt'), EVENT, LINK)).toContain('14 de novembro de 2030');
  });

  it('dates the event by its own zone, not the browser’s', () => {
    const late = { ...EVENT, startsAt: '2030-11-14T23:30:00+00:00', timeZone: 'Africa/Lagos' };

    expect(whatsAppMessage(guestIn('en'), late, LINK)).toContain('on 15 November 2030.');
  });

  it('writes in the organisation’s language when the rule has none for the guest', () => {
    expect(whatsAppMessage(guestIn(null, 'fr'), EVENT, LINK)).toContain('14 novembre 2030');
  });

  it('ends with the guest’s own link, whole', () => {
    expect(whatsAppMessage(guestIn('pt'), EVENT, LINK).endsWith(LINK)).toBe(true);
  });
});

describe('The address Send on WhatsApp opens (sc-26025)', () => {
  it('is WhatsApp’s own whatsapp: address, with the number’s digits and the words encoded', () => {
    const href = whatsAppHref(guestIn('en'), EVENT, LINK)!;
    const address = new URL(href);

    expect(address.protocol).toBe('whatsapp:');
    expect(href.startsWith('whatsapp://send?phone=2348035550142&text=')).toBe(true);
    expect(address.searchParams.get('text')).toBe(whatsAppMessage(guestIn('en'), EVENT, LINK));
    expect(href).not.toMatch(/wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|https?:\/\/[^%]/u);
  });

  it('is none for a guest with no mobile number', () => {
    expect(whatsAppHref({ ...guestIn('en'), mobile: null }, EVENT, LINK)).toBeNull();
  });
});

describe('The open questions, kept in the tab (sc-26025)', () => {
  it('keeps them per event for a reload, and forgets them once none is open', () => {
    keepAsked('ev_1', new Set(['g_1', 'g_2']));

    expect([...keptAsked('ev_1')]).toEqual(['g_1', 'g_2']);
    expect([...keptAsked('ev_2')]).toEqual([]);

    keepAsked('ev_1', new Set());
    expect(sessionStorage.length).toBe(0);
  });
});
