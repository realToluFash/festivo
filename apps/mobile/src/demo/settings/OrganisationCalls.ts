import {
  ApiError,
  type CompanyDomains,
  ERROR_TYPE_PREFIX,
  type RequestLink,
} from '@soirely/api-client';

import { SAMPLE } from '../samples.ts';
import type { OrganisationCalls } from '../../components/OrganisationJoining.tsx';
import {
  DELETE_COUNTS,
  DOMAINS_MOST,
  domainRefusal,
  LOADING_MS,
  type OrganisationStart,
  requestLink,
  restoreDeadline,
  RETRY_MS,
  SEND_MS,
  YOUR_DOMAIN,
} from './OrganisationModel.ts';
import { OWNERSHIP_WORDS } from './OrganisationWords.ts';

function after<T>(ms: number, value: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(value());
      } catch (error) {
        reject(error);
      }
    }, ms);
  });
}

/** The API's refusal, as the product reads it. */
export function refusal(
  code: string,
  title: string,
  violation?: { propertyPath: string; message: string },
): ApiError {
  return new ApiError({
    type: `${ERROR_TYPE_PREFIX}${code}`,
    title,
    status: 422,
    ...(violation != null && { violations: [{ ...violation, code }] }),
  });
}

/** Organisation's calls answered from the sample, as a state link starts them: the product's parts draw the demo. */
export function sampleCalls(start: OrganisationStart, locale: string): OrganisationCalls {
  let domains: CompanyDomains['domains'] = [{ domain: YOUR_DOMAIN, stopped: false }];
  let linkFails = start.link === 'failed';
  let link: RequestLink =
    start.link === 'turnedOff' ? { on: false, url: null } : { on: true, url: requestLink(0) };
  let linkWait = 0;
  let made = 0;
  let domainsWait = start.domainsLoading ? LOADING_MS : 0;
  const list = (): CompanyDomains => ({
    domains,
    most: DOMAINS_MOST,
    ownAddress: SAMPLE.email,
  });

  return {
    companyDomains: () => {
      const wait = domainsWait;
      domainsWait = 0;

      return after(wait, list);
    },
    addCompanyDomain: (_, domain) =>
      after(SEND_MS, () => {
        const refused = domainRefusal(
          domain,
          domains.map((one) => one.domain),
        );
        if (refused != null)
          throw refusal('validation_failed', refused, { propertyPath: 'domain', message: refused });
        domains = [...domains, { domain, stopped: false }];

        return list();
      }),
    removeCompanyDomain: (_, domain) =>
      after(SEND_MS, () => {
        domains = domains.filter((one) => one.domain !== domain);

        return list();
      }),
    requestLink: () => {
      if (!linkFails) {
        const wait = linkWait;
        linkWait = 0;

        return after(wait, () => link);
      }
      linkFails = false;
      linkWait = RETRY_MS;

      return Promise.reject(new Error('unreadable'));
    },
    turnOnRequestLink: () =>
      after(SEND_MS, () => {
        made += 1;
        link = { on: true, url: requestLink(made) };

        return link;
      }),
    turnOffRequestLink: () =>
      after(SEND_MS, () => {
        link = { on: false, url: null };

        return link;
      }),
    replaceRequestLink: () =>
      after(SEND_MS, () => {
        made += 1;
        link = { on: true, url: requestLink(made) };

        return link;
      }),
    prove: (first, code) =>
      after(SEND_MS, () => {
        if (!('password' in first) || first.password !== SAMPLE.password)
          throw refusal('invalid_credentials', OWNERSHIP_WORDS.passwordWrong);
        if (code == null) throw refusal('two_factor_required', OWNERSHIP_WORDS.codeAsked);
        const typed = code.replaceAll(/\s/gu, '').toLowerCase();
        if (typed !== SAMPLE.authenticator && typed !== SAMPLE.recovery)
          throw refusal('two_factor_code_invalid', OWNERSHIP_WORDS.codeWrong);

        return { proof: 'sample-proof', expiresAt: '' };
      }),
    transferOwnership: () => after(SEND_MS, () => undefined),
    leaveOrganisation: () => after(SEND_MS, () => undefined),
    organisationDeletion: () =>
      after(0, () => ({
        ...DELETE_COUNTS,
        restoreClosesAt: '',
        restoreCloses: restoreDeadline(new Date(), locale),
      })),
    deleteOrganisation: () =>
      after(SEND_MS, () => ({ ...DELETE_COUNTS, restoreClosesAt: '', restoreCloses: '' })),
  };
}
