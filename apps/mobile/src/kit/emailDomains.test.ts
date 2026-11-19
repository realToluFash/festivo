import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ApiError,
  ERROR_TYPE_PREFIX,
  type EmailDomain,
  type EmailDomainsPage,
} from '@soirely/api-client';
import { t, init } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import { dataAndControlListed } from './appNav.ts';
import {
  domainFieldProblem,
  domainRefusal,
  domainRows,
  domainsCard,
  hubCard,
  hubDomainsLine,
  recordFoot,
  removeAsks,
  verifiedOf,
} from './emailDomains.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const ORG = 'Ire Events';
const record = (domain: string) => ({
  type: 'TXT' as const,
  name: `_soirely-verify.${domain}`,
  value: 'k7q2m9x4c8rt5bn3wd6jp1hz0ys5gfa',
});

const OFF = {
  onlyOurs: 'off' as const,
  onlyOursFromAt: null,
  onlyOursFrom: null,
  onlyOursIfNowAt: null,
  onlyOursIfNow: null,
};

const day = (at: string) => `the day of ${at}`;

const PROVED: EmailDomain = {
  ...OFF,
  domain: 'ire.events',
  status: 'proved',
  record: record('ire.events'),
  addedAt: '2026-10-06T09:00:00Z',
  added: 'Tuesday 6 Oct at 10:00 WAT',
  provedAt: '2026-10-06T10:02:00Z',
  proved: 'Tuesday 6 Oct at 11:02 WAT',
  checksEndAt: '2026-10-13T09:00:00Z',
  checksEnd: 'Tuesday 13 Oct at 10:00 WAT',
  putBackByAt: null,
  putBackBy: null,
};

const WAITING: EmailDomain = {
  ...OFF,
  domain: 'ireevents.com',
  status: 'waiting',
  record: record('ireevents.com'),
  addedAt: '2026-10-16T15:45:00Z',
  added: 'Friday 16 Oct at 16:45 WAT',
  provedAt: null,
  proved: null,
  checksEndAt: '2026-10-23T15:45:00Z',
  checksEnd: 'Friday 23 Oct at 16:45 WAT',
  putBackByAt: null,
  putBackBy: null,
};

const FAILED: EmailDomain = {
  ...OFF,
  ...WAITING,
  domain: 'ire.co',
  status: 'failed',
  record: record('ire.co'),
  checksEndAt: '2026-10-12T08:30:00Z',
  checksEnd: 'Monday 12 Oct at 09:30 WAT',
};

const MISSING: EmailDomain = {
  ...OFF,
  ...PROVED,
  status: 'missing',
  putBackByAt: '2026-10-31T13:20:00Z',
  putBackBy: 'Saturday 31 Oct at 14:20 WAT',
};

const page = (
  domains: EmailDomain[],
  plan: EmailDomainsPage['plan'] = 'enterprise',
  ownerChanges = true,
): EmailDomainsPage => ({ plan, ownerChanges, domains });

describe('Email domains’ rows by status, with the instants as the server wrote them (sc-560)', () => {
  it('tags each status and dates its line in the reader’s own zone', () => {
    expect(domainRows(t, page([PROVED, WAITING, FAILED]), day)).toEqual([
      {
        domain: 'ire.events',
        tag: { kind: 'yes', word: 'Proved' },
        line: 'Proved Tuesday 6 Oct at 11:02 WAT',
        action: 'remove',
        only: {
          line: 'People at ire.events can still be members of other organisations.',
          control: 'switch',
          on: false,
        },
      },
      {
        domain: 'ireevents.com',
        tag: { kind: 'waiting', word: 'Waiting for the record' },
        line: 'We check every hour until Friday 23 Oct at 16:45 WAT',
        action: 'record',
        only: null,
      },
      {
        domain: 'ire.co',
        tag: { kind: 'no', word: 'Not proved' },
        line: 'We stopped checking on Monday 12 Oct at 09:30 WAT. Verify still works.',
        action: 'record',
        only: null,
      },
    ]);
  });

  it('opens a missing record’s record, asking to put it back by its day', () => {
    expect(domainRows(t, page([MISSING]), day)[0]).toEqual({
      domain: 'ire.events',
      tag: { kind: 'waiting', word: 'Record missing' },
      line: 'Put it back by Saturday 31 Oct at 14:20 WAT',
      action: 'record',
      only: {
        line: 'People at ire.events can still be members of other organisations.',
        control: 'switch',
        on: false,
      },
    });
  });

  it('keeps a proved domain read only, tagged Kept, once the organisation left Enterprise', () => {
    expect(domainRows(t, page([PROVED], 'left'), day)).toEqual([
      {
        domain: 'ire.events',
        tag: { kind: 'kept', word: 'Kept' },
        line: 'Proved Tuesday 6 Oct at 11:02 WAT',
        action: null,
        only: {
          line: 'Kept as it was. It comes back on with Enterprise.',
          control: null,
          on: false,
        },
      },
    ]);
  });

  it('dates the record’s foot by the checks’ end, their stop, or the put-back day', () => {
    expect(recordFoot(t, WAITING)).toBe('We check every hour until Friday 23 Oct at 16:45 WAT.');
    expect(recordFoot(t, FAILED)).toBe(
      'We stopped checking on Monday 12 Oct at 09:30 WAT. Verify still works.',
    );
    expect(recordFoot(t, MISSING)).toBe('Put it back by Saturday 31 Oct at 14:20 WAT.');
  });
});

describe('Email domains’ card', () => {
  it('puts a missing record before a failed one, and a failed one before a wait', () => {
    expect(domainsCard(t, page([WAITING, FAILED, MISSING]), null, ORG, 'en')).toEqual({
      says: 'The record for ire.events is missing',
      line: 'Put it back by Saturday 31 Oct at 14:20 WAT, or ire.events stops being proved and Only our organisation stops with it.',
      step: { label: 'See the record', go: { kind: 'record', domain: 'ire.events' } },
    });
    expect(domainsCard(t, page([WAITING, FAILED]), null, ORG, 'en').says).toBe(
      'ire.co was not proved',
    );
  });

  it('starts with Prove a domain when there is none', () => {
    expect(domainsCard(t, page([]), null, ORG, 'en')).toEqual({
      says: 'Prove the email domain of Ire Events',
      line: 'Add a DNS record where your domain is managed. Once it is proved, you can limit the accounts at it to Ire Events.',
      step: { label: 'Prove a domain', go: { kind: 'prove' } },
    });
  });

  it('says a domain was proved, at the instant the server wrote', () => {
    expect(
      domainsCard(
        t,
        page([PROVED, WAITING]),
        { kind: 'proved', domain: 'ire.events', at: 'Tuesday 6 Oct at 11:02 WAT' },
        ORG,
        'en',
      ),
    ).toEqual({
      says: 'ire.events is proved',
      line: 'Proved Tuesday 6 Oct at 11:02 WAT.',
      step: {
        label: 'Limit ire.events accounts to Ire Events',
        go: { kind: 'only', domain: 'ire.events' },
      },
    });
  });

  it('says a removed domain is no longer proved, with the next record still to add', () => {
    expect(
      domainsCard(t, page([WAITING]), { kind: 'removed', domain: 'ire.events' }, ORG, 'en'),
    ).toEqual({
      says: 'ire.events was removed',
      line: 'It is no longer proved.',
      step: { label: 'See the record', go: { kind: 'record', domain: 'ireevents.com' } },
    });
  });

  it('locks the page on Free, and keeps it read only once the organisation left Enterprise', () => {
    expect(domainsCard(t, page([], 'free'), null, ORG, 'en')).toEqual({
      says: 'Available on Enterprise',
      line: 'Prove that Ire Events owns its domain, then limit the accounts at it to Ire Events.',
      step: null,
    });
    expect(domainsCard(t, page([PROVED], 'left'), null, ORG, 'en')).toEqual({
      says: null,
      line: 'Ire Events left Enterprise. Its domains are kept as they were, and come back on with Enterprise.',
      step: null,
    });
  });
});

describe('Data and control’s hub', () => {
  it('takes the soonest instant among Control’s items for its card', () => {
    const sooner: EmailDomain = {
      ...WAITING,
      domain: 'lumen.events',
      checksEndAt: '2026-10-20T08:00:00Z',
      checksEnd: 'Tuesday 20 Oct at 09:00 WAT',
    };

    expect(hubCard(t, page([PROVED, WAITING, sooner]), ORG, 'en')).toEqual({
      says: 'lumen.events is waiting for its record',
      line: 'We check every hour until Tuesday 20 Oct at 09:00 WAT.',
      step: { label: 'See the record', go: { kind: 'record', domain: 'lumen.events' } },
    });
  });

  it('needs nothing once every domain is proved, and starts with Prove a domain with none', () => {
    expect(hubCard(t, page([PROVED]), ORG, 'en')).toEqual({
      says: 'Nothing needs your attention',
      line: 'ire.events is proved.',
      step: null,
    });
    expect(hubCard(t, page([]), ORG, 'en')).toEqual({
      says: 'Nothing is set up yet',
      line: 'Start by proving the email domain of Ire Events.',
      step: { label: 'Prove a domain', go: { kind: 'prove' } },
    });
  });

  it('locks on Free and keeps everything as it was off Enterprise', () => {
    expect(hubCard(t, page([], 'free'), ORG, 'en')).toEqual({
      says: 'These come with Enterprise',
      line: 'Email domains and the audit log.',
      step: null,
    });
    expect(hubCard(t, page([PROVED], 'left'), ORG, 'en').line).toBe(
      'Email domains, the audit log and deleting guest data are switched off and kept as they were. They come back on with Enterprise.',
    );
    expect(hubDomainsLine(t, page([PROVED], 'left'), ORG)).toBe('ire.events kept as it was');
    expect(hubDomainsLine(t, page([], 'free'), ORG)).toBe(
      'Prove your domain and limit its accounts to Ire Events',
    );
  });

  it('lists each domain and where it stands on the Email domains row', () => {
    expect(hubDomainsLine(t, page([PROVED, WAITING]), ORG)).toBe(
      'ire.events proved · ireevents.com waiting for the record',
    );
    expect(hubDomainsLine(t, page([]), ORG)).toBe('No domains yet');
  });

  it('says in one line that exporting and deleting guest data are on the web', () => {
    const hub = readFileSync(join('app', 'settings', 'data-and-control', 'index.tsx'), 'utf8');

    expect(hub).toContain("<Line size={14} text={t('dataAndControl.onTheWeb')} />");
    expect(en.dataAndControl.onTheWeb).toBe(
      'Export all data, deleting guest data after an event and a guest’s request are on the web.',
    );
  });

  it('holds Email domains then Audit log under Control (sc-611)', () => {
    const hub = readFileSync(join('app', 'settings', 'data-and-control', 'index.tsx'), 'utf8');

    expect(hub.match(/<TagRow/gu)).toHaveLength(2);
    expect(hub.indexOf("'dataAndControl.rows.domains'")).toBeLessThan(
      hub.indexOf("'dataAndControl.rows.audit'"),
    );
    expect(en.dataAndControl.rows.auditLine).toBe('Who did what, for 365 days');
  });
});

describe('Data and control in Settings', () => {
  it('lists it for an Owner or an Admin, and never for a Member', () => {
    expect(dataAndControlListed({ permissions: ['organisation.manage', 'members.read'] })).toBe(
      true,
    );
    expect(dataAndControlListed({ permissions: ['members.read', 'events.read'] })).toBe(false);
    expect(dataAndControlListed(null)).toBe(false);
  });

  it('adds the row after the organisation’s rows only where it is listed', () => {
    const list = readFileSync(join('src', 'components', 'SettingsList.tsx'), 'utf8');

    expect(list).toMatch(
      /heading === 'organisationHeading' && dataAndControlListed\(organisation\)\s+\? \[\.\.\.rows, dataRow\]/u,
    );
    expect(en.settings.dataAndControlLine).toBe('Email domains and the audit log');
  });

  it('sends a Member who opens either page back to Settings', () => {
    for (const file of ['index.tsx', 'email-domains.tsx', 'audit-log.tsx'])
      expect(readFileSync(join('app', 'settings', 'data-and-control', file), 'utf8')).toMatch(
        /if \(organisation != null && !listed\)\s+return <Redirect href=\{DESTINATION_HREF\.settings\} \/>;/u,
      );
  });
});

const refused = (code: string, message: string) =>
  new ApiError({
    type: `${ERROR_TYPE_PREFIX}validation_failed`,
    title: 'Validation failed',
    status: 422,
    violations: [{ propertyPath: 'domain', message, code }],
  });

describe('adding a domain', () => {
  it('checks the field before sending, in Company domain joining’s words', () => {
    expect(domainFieldProblem(t, '  ', 'ire.events')).toBe('Enter a domain, like ire.events.');
    expect(domainFieldProblem(t, 'ire events', 'ire.events')).toBe(
      'Enter a domain with a dot and no spaces, like ire.events.',
    );
    expect(domainFieldProblem(t, 'ire.events', 'ire.events')).toBeNull();
  });

  it.each([
    ['domain_blank', 'Enter a domain.'],
    ['domain_invalid', 'Enter a domain with a dot and no spaces.'],
    ['domain_public', 'You cannot use a public email domain.'],
    ['domain_listed', 'ire.events is already on the list.'],
    [
      'domain_taken',
      'Another organisation has already proved this domain. Contact Soirely support if it is yours.',
    ],
  ])('shows the server’s words for %s under the field', (code, message) => {
    expect(domainRefusal(refused(code, message))).toBe(message);
  });

  it('leaves any other failure to the screen’s own line', () => {
    expect(domainRefusal(new Error('offline'))).toBeNull();
  });
});

describe('Verify and Remove', () => {
  it('proves a found record at the server’s instant, and keeps the record open when not found', () => {
    const proved = page([{ ...WAITING, status: 'proved', proved: 'Monday 19 Oct at 10:12 WAT' }]);

    expect(verifiedOf(true, proved, 'ireevents.com')).toEqual({
      kind: 'proved',
      at: 'Monday 19 Oct at 10:12 WAT',
    });
    expect(verifiedOf(false, page([WAITING]), 'ireevents.com')).toEqual({ kind: 'notFound' });
  });

  it('asks before removing a proved domain only; a waiting or failed one goes at once', () => {
    expect(removeAsks(PROVED)).toBe(true);
    expect(removeAsks(MISSING)).toBe(true);
    expect(removeAsks(WAITING)).toBe(false);
    expect(removeAsks(FAILED)).toBe(false);
  });
});

describe('Organisation’s Company domain joining (sc-560)', () => {
  it('tags a domain the organisation proved under Email domains Proved, as the API says', () => {
    const joining = readFileSync(join('src', 'components', 'OrganisationJoining.tsx'), 'utf8');

    expect(joining).toMatch(/list\.domains\.map\(\(\{ domain, stopped, proved \}\)/u);
    expect(joining).toMatch(
      /tag=\{\s*proved \? \{ kind: 'yes', word: t\('companyDomains\.proved'\) \} : null\s*\}/u,
    );
  });
});

describe('Only our organisation under a proved domain (sc-563)', () => {
  const SCHEDULED: EmailDomain = {
    ...PROVED,
    onlyOurs: 'scheduled',
    onlyOursFromAt: '2026-10-31T13:20:00Z',
    onlyOursFrom: 'Saturday 31 Oct at 14:20 WAT',
  };
  const ON: EmailDomain = { ...SCHEDULED, onlyOurs: 'on' };

  it('gives the Owner a switch, Cancel while it is scheduled, and the instant it starts', () => {
    expect(domainRows(t, page([SCHEDULED]), day)[0]?.only).toEqual({
      line: 'Starts Saturday 31 Oct at 14:20 WAT',
      control: 'cancel',
      on: false,
    });
    expect(domainRows(t, page([ON]), day)[0]?.only).toEqual({
      line: 'On since the day of 2026-10-31T13:20:00Z',
      control: 'switch',
      on: true,
    });
    expect(domainsCard(t, page([SCHEDULED]), null, ORG, 'en')).toEqual({
      says: 'Only our organisation starts on Saturday 31 Oct at 14:20 WAT',
      line: 'Everyone at ire.events was emailed. You can cancel until then.',
      step: null,
    });
    expect(domainsCard(t, page([ON]), null, ORG, 'en')).toEqual({
      says: 'Accounts at ire.events belong to Ire Events',
      line: 'They can still be given access to another organisation’s event.',
      step: null,
    });
  });

  it('gives an admin its state and that only an owner can change it, with no control', () => {
    expect(domainRows(t, page([SCHEDULED], 'enterprise', false), day)[0]?.only).toEqual({
      line: 'Starts Saturday 31 Oct at 14:20 WAT. Only an owner can change this.',
      control: null,
      on: false,
    });
    expect(domainsCard(t, page([SCHEDULED], 'enterprise', false), null, ORG, 'en').line).toBe(
      'Only an owner can cancel it.',
    );
    expect(domainsCard(t, page([PROVED], 'enterprise', false), null, ORG, 'en').step).toBeNull();
  });

  it('says a cancel and a switch off', () => {
    expect(
      domainsCard(t, page([PROVED]), { kind: 'cancelled', domain: 'ire.events' }, ORG, 'en'),
    ).toEqual({
      says: 'Only our organisation was cancelled',
      line: 'Nothing changes for the accounts at ire.events.',
      step: null,
    });
    expect(
      domainsCard(t, page([PROVED]), { kind: 'turnedOff', domain: 'ire.events' }, ORG, 'en'),
    ).toEqual({
      says: 'Only our organisation is off',
      line: 'Accounts at ire.events can be members of other organisations again.',
      step: null,
    });
  });
});
