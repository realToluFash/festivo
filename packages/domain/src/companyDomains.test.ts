import { describe, expect, it } from 'vitest';

import { companyDomainProblem, domainOf, normaliseDomain } from './companyDomains.ts';

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
