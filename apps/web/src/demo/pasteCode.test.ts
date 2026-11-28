import { describe, expect, it } from 'vitest';

import { codeInPaste } from './pasteCode.ts';

describe('Paste code finds one code in what was copied (sc-99215)', () => {
  it('takes six digits in a row, or split by one space or one hyphen', () => {
    expect(codeInPaste('123456')).toBe('123456');
    expect(codeInPaste('123 456')).toBe('123456');
    expect(codeInPaste('123-456')).toBe('123456');
  });

  it('takes the code out of a whole WhatsApp or text message', () => {
    expect(
      codeInPaste('*482193* is your verification code. For your security, do not share it.'),
    ).toBe('482193');
    expect(codeInPaste('Soirely: your code is 482 193. It expires in 10 minutes.')).toBe('482193');
  });

  it('counts the same code written twice as one', () => {
    expect(codeInPaste('Your code is 482193. Code: 482193')).toBe('482193');
    expect(codeInPaste('482193 or 482-193')).toBe('482193');
  });

  it('refuses two different codes', () => {
    expect(codeInPaste('482193 and 771204')).toBeNull();
  });

  it('refuses nothing, only spaces, and text with no code', () => {
    expect(codeInPaste('')).toBeNull();
    expect(codeInPaste('   ')).toBeNull();
    expect(codeInPaste('See you at the door at 19:30')).toBeNull();
    expect(codeInPaste('12345')).toBeNull();
    expect(codeInPaste('12 34 56')).toBeNull();
  });

  it('refuses a group that is part of a longer number', () => {
    expect(codeInPaste('1234567')).toBeNull();
    expect(codeInPaste('+2348012345678')).toBeNull();
    expect(codeInPaste('+234 801 234 5678')).toBeNull();
    expect(codeInPaste('+234-801-234-5678')).toBeNull();
    expect(codeInPaste('123 456 7')).toBeNull();
    expect(codeInPaste('9-123456')).toBeNull();
  });

  it('keeps a code beside a phone number it is not part of', () => {
    expect(codeInPaste('Code 482193 sent to +234 801 234 5678')).toBe('482193');
  });
});
