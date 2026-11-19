import type { OrganisationExportPage } from '@soirely/api-client';
import type { TFunction } from 'i18next';

/** The card Export all data shows (sc-612), in the demo's states: `/demo/settings/data-and-control/export?state=…`; `…Other` is the organisation's export as anyone but its asker sees it (ux #68069). */
export type ExportCardState =
  | 'idle'
  | 'preparing'
  | 'ready'
  | 'used'
  | 'expired'
  | 'failed'
  | 'preparingOther'
  | 'readyOther'
  | 'usedOther'
  | 'expiredOther'
  | 'failedOther'
  | 'notOwner';

export type ExportStep = 'export' | 'download' | 'retry';

export interface ExportCard {
  state: ExportCardState;
  says: string;
  lines: string[];
  step: ExportStep | null;
}

const OTHER = {
  preparing: 'preparingOther',
  ready: 'readyOther',
  used: 'usedOther',
  expired: 'expiredOther',
  failed: 'failedOther',
} as const;

/** The export belongs to the organisation: its asker sees their own, and everyone else sees it as the asker's. */
export function cardStateOf(page: OrganisationExportPage): ExportCardState {
  const exported = page.export;

  if (exported == null) return page.owner ? 'idle' : 'notOwner';
  if (!exported.mine) return OTHER[exported.state];

  return exported.state;
}

/** An Owner who did not ask sees the organisation's state with its next-export line; an Admin sees it with neither step nor that line, and an owner named where an Owner's says "you can" (pm #68119). */
export function exportCard(
  t: TFunction,
  page: OrganisationExportPage,
  organisation: string,
  email: string,
): ExportCard {
  const state = cardStateOf(page);
  const exported = page.export;
  const next =
    page.nextAllowed == null ? [] : [t('exportAllData.next', { when: page.nextAllowed })];
  const othersNext = page.owner ? next : [];
  const ownerStep = (step: ExportStep): ExportStep | null => (page.owner ? step : null);
  // Once the daily limit has lifted, a downloaded export is no bar to the next one.
  const againStep = page.nextAllowed == null ? ownerStep('export') : null;

  switch (state) {
    case 'preparing':
      return {
        state,
        says: t('exportAllData.preparingSays'),
        lines: [t('exportAllData.preparingLine', { when: exported?.asked, email })],
        step: null,
      };
    case 'ready':
      return {
        state,
        says: t('exportAllData.readySays'),
        lines: [t('exportAllData.readyLine', { email, when: exported?.expires }), ...next],
        step: 'download',
      };
    case 'used':
      return {
        state,
        says: t('exportAllData.usedSays'),
        lines: [t('exportAllData.usedLine', { when: exported?.downloaded }), ...next],
        step: againStep,
      };
    case 'expired':
      return {
        state,
        says: t('exportAllData.expiredSays'),
        lines: [t('exportAllData.expiredLine', { when: exported?.expires })],
        step: 'export',
      };
    case 'failed':
      return {
        state,
        says: t('exportAllData.failedSays'),
        lines: [t('exportAllData.failedLine')],
        step: 'retry',
      };
    case 'preparingOther':
      return {
        state,
        says: t('exportAllData.preparingOtherSays', { organisation }),
        lines: [
          t('exportAllData.preparingOtherLine', { name: exported?.askedBy, when: exported?.asked }),
          ...othersNext,
        ],
        step: null,
      };
    case 'readyOther':
      return {
        state,
        says: t('exportAllData.readyOtherSays', { organisation }),
        lines: [
          t('exportAllData.readyOtherLine', {
            name: exported?.askedBy,
            when: exported?.asked,
            until: exported?.expires,
          }),
          ...othersNext,
        ],
        step: null,
      };
    case 'usedOther':
      return {
        state,
        says: t('exportAllData.usedOtherSays', { organisation }),
        lines: [
          t('exportAllData.usedOtherLine', { name: exported?.askedBy, when: exported?.downloaded }),
          ...othersNext,
        ],
        step: againStep,
      };
    case 'expiredOther':
      return {
        state,
        says: t('exportAllData.expiredOtherSays', { organisation }),
        lines: [
          t(page.owner ? 'exportAllData.expiredOtherLine' : 'exportAllData.expiredAdminLine', {
            when: exported?.expires,
          }),
        ],
        step: ownerStep('export'),
      };
    case 'failedOther':
      return {
        state,
        says: t('exportAllData.failedOtherSays', { organisation }),
        lines: [t('exportAllData.failedLine')],
        step: ownerStep('retry'),
      };
    case 'notOwner':
      return {
        state,
        says: t('exportAllData.notOwnerSays', { organisation }),
        lines: [t('exportAllData.notOwnerLine', { organisation })],
        step: null,
      };
    case 'idle':
      return {
        state,
        says: t('exportAllData.idleSays', { organisation }),
        lines: [t('exportAllData.idleLine')],
        step: 'export',
      };
  }
}

/** The hub's row for Export all data (ux #68069): only Ready carries the tag, and a link that ended unused reads as nothing asked, since an Owner can export again. */
export function exportRow(
  t: TFunction,
  page: OrganisationExportPage,
  organisation: string,
): { line: string; ready: boolean } {
  const exported = page.export;

  switch (cardStateOf(page)) {
    case 'ready':
      return { line: t('dataControl.exportReadyMine', { when: exported?.expires }), ready: true };
    case 'readyOther':
      return { line: t('dataControl.exportReadyOther', { name: exported?.askedBy }), ready: true };
    case 'preparing':
      return { line: t('dataControl.exportPreparingMine'), ready: false };
    case 'preparingOther':
      return {
        line: t('dataControl.exportPreparingOther', { name: exported?.askedBy }),
        ready: false,
      };
    case 'used':
    case 'usedOther':
      return { line: t('dataControl.exportDownloaded'), ready: false };
    case 'failed':
    case 'failedOther':
      return { line: t('dataControl.exportFailed'), ready: false };
    case 'expired':
    case 'expiredOther':
    case 'idle':
    case 'notOwner':
      return { line: t('dataControl.exportIdle', { organisation }), ready: false };
  }
}

/** While an export is preparing the page asks again, so Ready arrives without a reload. */
export const PREPARING_POLL_MS = 5000;

export function isPreparing(page: OrganisationExportPage | null): boolean {
  return page?.export?.state === 'preparing';
}

/** The browser saves the archive, named for the organisation and the day it was asked for. */
export function saveArchive(
  bytes: Uint8Array<ArrayBuffer>,
  organisation: string,
  askedAt: string,
): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const link = document.createElement('a');

  link.href = url;
  link.download = `${organisation} ${askedAt.slice(0, 10)}.zip`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
