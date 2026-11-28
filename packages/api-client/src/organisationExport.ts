/** Data and control › Export all data, as the API answers it (sc-612): the last export, and when the next may start. */

export type OrganisationExportState = 'preparing' | 'ready' | 'used' | 'expired' | 'failed';

export interface OrganisationExport {
  id: string;
  state: OrganisationExportState;
  /** Asked for by the person reading: only they download it. */
  mine: boolean;
  askedBy: string;
  askedAt: string;
  /** Each instant written in the reader's own zone by the API (sc-868), "Sunday 18 Oct at 14:52 WAT". */
  asked: string;
  expiresAt: string | null;
  expires: string | null;
  downloadedAt: string | null;
  downloaded: string | null;
}

export interface OrganisationExportPage {
  /** Only an Owner exports; an Admin reads where it stands. */
  owner: boolean;
  export: OrganisationExport | null;
  nextAllowedAt: string | null;
  nextAllowed: string | null;
}

const STATES: readonly OrganisationExportState[] = [
  'preparing',
  'ready',
  'used',
  'expired',
  'failed',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

const text = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

function asOrganisationExport(raw: unknown): OrganisationExport | null {
  if (!isRecord(raw)) return null;
  const state = STATES.find((one) => one === raw.state);

  if (
    state == null ||
    typeof raw.id !== 'string' ||
    typeof raw.mine !== 'boolean' ||
    typeof raw.askedBy !== 'string' ||
    typeof raw.askedAt !== 'string' ||
    typeof raw.asked !== 'string' ||
    !text(raw.expiresAt) ||
    !text(raw.expires) ||
    !text(raw.downloadedAt) ||
    !text(raw.downloaded)
  )
    return null;

  return {
    id: raw.id,
    state,
    mine: raw.mine,
    askedBy: raw.askedBy,
    askedAt: raw.askedAt,
    asked: raw.asked,
    expiresAt: raw.expiresAt,
    expires: raw.expires,
    downloadedAt: raw.downloadedAt,
    downloaded: raw.downloaded,
  };
}

export function asOrganisationExportPage(raw: unknown): OrganisationExportPage | null {
  if (!isRecord(raw) || typeof raw.owner !== 'boolean') return null;
  if (!text(raw.nextAllowedAt) || !text(raw.nextAllowed)) return null;
  const exported = raw.export === null ? null : asOrganisationExport(raw.export);
  if (raw.export !== null && exported == null) return null;

  return {
    owner: raw.owner,
    export: exported,
    nextAllowedAt: raw.nextAllowedAt,
    nextAllowed: raw.nextAllowed,
  };
}
