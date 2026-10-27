import { describe, expect, it } from 'vitest';

import {
  HOST_NAME_MAXIMUM,
  hostNameOf,
  hostProblems,
  hostsChanged,
  hostsLine,
  keepsLastHost,
  needsHost,
} from './hosts.ts';

describe('hostNameOf', () => {
  it('turns each run of line breaks into one space and trims, as the API saves it', () => {
    expect(hostNameOf('  The Okafor\r\n\nfamily ')).toBe('The Okafor family');
  });
});

describe('hostProblems', () => {
  it('takes 60 code points and refuses 61, counting an accented letter once', () => {
    expect(hostProblems(['é'.repeat(HOST_NAME_MAXIMUM)])).toEqual([null]);
    expect(hostProblems(['é'.repeat(61)])).toEqual([{ problem: 'hostTooLong', length: 61 }]);
  });

  it('refuses a name that is blank once trimmed', () => {
    expect(hostProblems(['Funmi', ' \n '])).toEqual([null, { problem: 'hostBlank' }]);
  });

  it('refuses a repeat on the later row, regardless of case, naming the earlier as typed', () => {
    expect(hostProblems(['Funmi Adeyemi', 'Tayo', ' funmi ADEYEMI'])).toEqual([
      null,
      null,
      { problem: 'hostDuplicate', name: 'Funmi Adeyemi' },
    ]);
  });
});

describe('hostsChanged', () => {
  it('sees a new order as a change, and a trailing space as none', () => {
    expect(hostsChanged(['Funmi', 'Tayo'], ['Tayo', 'Funmi'])).toBe(true);
    expect(hostsChanged(['Funmi', 'Tayo'], ['Funmi ', 'Tayo'])).toBe(false);
  });
});

describe('hostsLine', () => {
  const cases: [string, string[], string][] = [
    ['en', ['Funmi'], 'Funmi'],
    ['en', ['Funmi', 'Tayo'], 'Funmi and Tayo'],
    ['en', ['Funmi', 'Tayo', 'Ade'], 'Funmi, Tayo, and Ade'],
    ['es', ['Funmi'], 'Funmi'],
    ['es', ['Funmi', 'Tayo'], 'Funmi y Tayo'],
    ['es', ['Funmi', 'Tayo', 'Ade'], 'Funmi, Tayo y Ade'],
    ['fr', ['Funmi'], 'Funmi'],
    ['fr', ['Funmi', 'Tayo'], 'Funmi et Tayo'],
    ['fr', ['Funmi', 'Tayo', 'Ade'], 'Funmi, Tayo et Ade'],
    ['pt', ['Funmi'], 'Funmi'],
    ['pt', ['Funmi', 'Tayo'], 'Funmi e Tayo'],
    ['pt', ['Funmi', 'Tayo', 'Ade'], 'Funmi, Tayo e Ade'],
  ];

  it.each(cases)('joins the hosts for %s: %j', (locale, hosts, line) => {
    expect(hostsLine(hosts, locale)).toBe(line);
  });

  it('keeps the order it is given', () => {
    expect(hostsLine(['Tayo', 'Funmi'], 'en')).toBe('Tayo and Funmi');
  });
});

describe('needsHost', () => {
  it('is true for a Draft with no host only', () => {
    expect(needsHost({ status: 'draft', hosts: [] })).toBe(true);
    expect(needsHost({ status: 'draft', hosts: ['Funmi'] })).toBe(false);
    expect(needsHost({ status: 'live', hosts: [] })).toBe(false);
  });
});

describe('keepsLastHost', () => {
  it('keeps the last name once the event is no longer a Draft', () => {
    expect(keepsLastHost({ status: 'live', hosts: ['Funmi'] }, 1)).toBe(true);
    expect(keepsLastHost({ status: 'live', hosts: ['Funmi'] }, 2)).toBe(false);
    expect(keepsLastHost({ status: 'paused', hosts: ['Funmi'] }, 1)).toBe(true);
    expect(keepsLastHost({ status: 'draft', hosts: ['Funmi'] }, 1)).toBe(false);
  });

  it('lets a live event with no saved host remove a row it has just added', () => {
    expect(keepsLastHost({ status: 'live', hosts: [] }, 1)).toBe(false);
    expect(keepsLastHost({ status: 'live', hosts: [] }, 0)).toBe(false);
  });
});
