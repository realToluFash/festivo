import { ASKER, CLOCK, LINK_UNTIL, NEXT_EXPORT, ORG, when } from './dataControl.ts';
import type { ReaderZone } from './dataSettings.ts';
import { SAMPLE } from './rules.ts';

export type ExportState =
  | 'ex_idle'
  | 'ex_preparing'
  | 'ex_ready'
  | 'ex_ready_other'
  | 'ex_used'
  | 'ex_used_link'
  | 'ex_expired'
  | 'ex_limited'
  | 'ex_failed'
  | 'not_owner';

export const EXPORT_STATES: readonly (ExportState | 'loading' | 'failed')[] = [
  'ex_idle',
  'ex_preparing',
  'ex_ready',
  'ex_ready_other',
  'ex_used',
  'ex_used_link',
  'ex_expired',
  'ex_limited',
  'ex_failed',
  'not_owner',
  'loading',
  'failed',
];

export const EXPORT_WORDS = {
  title: 'Export all data',
  holds: 'What the archive holds',
  rows: [
    'The organisation: its details, company domains and sign-in rules',
    'Members with their role, state and when they joined; invitations and requests to join',
    'Events with their People',
    'Each event’s guests and companions: name, email address, mobile number, reply and host',
  ],
  foot: 'One .zip: a JSON file of everything and a CSV file per table, every time in UTC. It leaves out your own account’s sign-in methods, sessions, two-factor and phones, and the audit log, which Audit log exports.',
  export: 'Export all data',
  download: 'Download',
  tryAgain: 'Try again',
  usedLink: 'This download has been used. It downloads nothing now.',
  loading: 'Loading Export all data…',
  failed: 'We could not load Export all data.',
} as const;

export type ExportStep = 'export' | 'download' | 'retry';

export interface ExportCard {
  says: string;
  lines: string[];
  step: ExportStep | null;
}

/** The card for each state; the next export's line follows any export that ended this day. */
export function exportCard(state: ExportState, locale: string, zone: ReaderZone): ExportCard {
  const next = `The next export can start on ${when(NEXT_EXPORT, locale, zone)}.`;

  switch (state) {
    case 'ex_preparing':
      return {
        says: 'Preparing your export',
        lines: [
          `Asked by you, ${when(CLOCK.asked, locale, zone)}. We’ll email ${SAMPLE.email} when it’s ready, and it shows here.`,
        ],
        step: null,
      };
    case 'ex_ready':
      return {
        says: 'Your export is ready',
        lines: [
          `We emailed a link to ${SAMPLE.email}. It downloads once, until ${when(LINK_UNTIL, locale, zone)}, and only for you, signed in.`,
          next,
        ],
        step: 'download',
      };
    case 'ex_ready_other':
      return {
        says: `${ORG}’ export is ready`,
        lines: [
          `Asked by ${ASKER.name}, ${when(CLOCK.asked, locale, zone)}. Only they can download it, until ${when(LINK_UNTIL, locale, zone)}.`,
        ],
        step: null,
      };
    case 'ex_used':
    case 'ex_used_link':
    case 'ex_limited':
      return {
        says: 'Your export was downloaded',
        lines: [`Downloaded ${when(CLOCK.used, locale, zone)}. Its link is used up.`, next],
        step: null,
      };
    case 'ex_expired':
      return {
        says: 'Your export’s link has ended',
        lines: [
          `It ended on ${when(LINK_UNTIL, locale, zone)} without a download. You can export again.`,
        ],
        step: 'export',
      };
    case 'ex_failed':
      return {
        says: 'Your export did not finish',
        lines: ['Nothing was emailed, and it doesn’t count toward today’s export.'],
        step: 'retry',
      };
    case 'not_owner':
      return {
        says: `Only an owner exports ${ORG}’ data`,
        lines: [`An owner can take everything ${ORG} holds in one archive.`],
        step: null,
      };
    case 'ex_idle':
      return {
        says: `Take everything ${ORG} holds`,
        lines: ['One archive, on every plan. Only an owner exports it.'],
        step: 'export',
      };
  }
}

/** The 429: the next export's instant, said above the card, and nothing started. */
export function limitedLine(locale: string, zone: ReaderZone): string {
  return `The next export can start on ${when(NEXT_EXPORT, locale, zone)}. Nothing was started.`;
}

export function exportStateOf(raw: string): ExportState | 'loading' | 'failed' {
  return EXPORT_STATES.find((one) => one === raw) ?? 'ex_idle';
}

/** Somebody who is not the asker sees Folake's export as hers, and an admin never the owner's step. */
export function exportFor(state: ExportState, owns: boolean): ExportState {
  if (owns) return state === 'not_owner' ? 'ex_idle' : state;

  return state === 'ex_ready' || state === 'ex_preparing' || state === 'ex_ready_other'
    ? 'ex_ready_other'
    : 'not_owner';
}

/** Where a step goes in Play: preparing, then ready; a download uses the link up. */
export function afterStep(step: ExportStep): ExportState {
  return step === 'download' ? 'ex_used' : 'ex_preparing';
}
