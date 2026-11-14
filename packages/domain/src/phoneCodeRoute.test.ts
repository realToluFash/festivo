import { describe, expect, it } from 'vitest';

import { codeWording } from './phoneCodeRoute.ts';

describe('where the phone code went', () => {
  it('speaks of WhatsApp, offers a text, and watches while the code is on WhatsApp', () => {
    expect(codeWording('whatsapp')).toEqual({
      line: 'whatsapp',
      fromWhatsApp: true,
      offerText: true,
      watch: true,
    });
  });

  it('says WhatsApp did not reach them once it falls back, and offers nothing more', () => {
    expect(codeWording('sms_fallback')).toMatchObject({
      line: 'fallback',
      fromWhatsApp: false,
      offerText: false,
      watch: false,
    });
  });

  it('says the same code was texted once they chose a text', () => {
    expect(codeWording('sms_chosen')).toMatchObject({
      line: 'chosen',
      fromWhatsApp: false,
      offerText: false,
    });
  });

  it('reads as it always has for a texted code, a later one after the choice, or one from before WhatsApp', () => {
    expect(codeWording('sms_only').line).toBe('texted');
    expect(codeWording('sms_preferred').line).toBe('texted');
    expect(codeWording(null).line).toBe('texted');
  });
});
