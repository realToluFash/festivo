import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  companyDomainProblem,
  domainOf,
  normaliseDomain,
  removalAnswers,
} from './companyDomains.ts';

describe('a company domain checked before it is sent', () => {
  it('is there', () => {
    expect(companyDomainProblem('')).toBe('blank');
    expect(companyDomainProblem('   ')).toBe('blank');
  });

  it('has a dot and no spaces', () => {
    expect(companyDomainProblem('ireevents')).toBe('shape');
    expect(companyDomainProblem('ire events.com')).toBe('shape');
    expect(companyDomainProblem('folake@ire.events')).toBe('shape');
    expect(companyDomainProblem('-ire.events')).toBe('shape');
    expect(companyDomainProblem(' IRE.Events ')).toBeNull();
    expect(companyDomainProblem('ire-catering.co.uk')).toBeNull();
  });

  it('is read as the API reads it', () => {
    expect(normaliseDomain('  IRE.Events ')).toBe('ire.events');
  });
});

describe('the domain an address is at', () => {
  it('is what follows its last @', () => {
    expect(domainOf('Folake@IRE.events')).toBe('ire.events');
    expect(domainOf('folake')).toBeNull();
    expect(domainOf(null)).toBeNull();
  });
});

describe('a refusal after a removal that works (sc-11816)', () => {
  it('goes when it said the domain removed was on the list', () => {
    expect(removalAnswers('domain_listed', ' IRE.events ', 'ire.events')).toBe(true);
    expect(removalAnswers('domain_listed', 'ire.events', 'ire.ng')).toBe(false);
  });

  it('goes when it said the list was full, whichever domain came off', () => {
    expect(removalAnswers('domain_full', 'ire.events', 'ire.ng')).toBe(true);
  });

  it('stays when it describes the domain typed', () => {
    for (const code of [
      'domain_not_yours',
      'domain_public',
      'domain_proved_elsewhere',
      undefined,
    ]) {
      expect(removalAnswers(code, 'ire.events', 'ire.events')).toBe(false);
    }
  });

  it("names codes the API's DomainRefusal sends", () => {
    const source = readFileSync(
      new URL('../../../services/api/src/Enum/DomainRefusal.php', import.meta.url),
      'utf8',
    );

    expect(source).toContain("= 'domain_listed';");
    expect(source).toContain("= 'domain_full';");
  });
});
