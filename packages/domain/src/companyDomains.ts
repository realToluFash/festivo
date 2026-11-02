/** The API's DomainNameNormaliser check: labels of letters, digits and inner hyphens, with a dot. */
const HOSTNAME = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** The domain a company domain listing compares, as the API reads it: trimmed and lowercased. */
export function normaliseDomain(typed: string): string {
  return typed.trim().toLowerCase();
}

/** What is wrong with a typed domain before it is sent; the rest (yours, public, full) is the API's. */
export function companyDomainProblem(typed: string): 'blank' | 'shape' | null {
  const domain = normaliseDomain(typed);

  if (domain === '') return 'blank';

  return HOSTNAME.test(domain) ? null : 'shape';
}

/** The part after the last @, so the form's example is the domain the person's own address is at. */
export function domainOf(address: string | null): string | null {
  const at = address?.lastIndexOf('@') ?? -1;
  const domain = at < 0 || address == null ? '' : normaliseDomain(address.slice(at + 1));

  return domain === '' ? null : domain;
}

/** The two refusals a removal that works makes untrue (sc-11816); the rest describe the domain typed, and stay. */
export function removalAnswers(code: string | undefined, typed: string, removed: string): boolean {
  return code === 'domain_full' || (code === 'domain_listed' && normaliseDomain(typed) === removed);
}
