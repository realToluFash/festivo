import type { OrganisationExportPage } from '@soirely/api-client';
import type { TFunction } from 'i18next';

/** The card Export all data shows (sc-612), in the demo's states: `/demo/settings/data-and-control/export?state=…`. */
export type ExportCardState =
  'idle' | 'preparing' | 'ready' | 'readyOther' | 'used' | 'expired' | 'failed' | 'notOwner';

export type ExportStep = 'export' | 'download' | 'retry';

export interface ExportCard {
  state: ExportCardState;
  says: string;
  lines: string[];
  step: ExportStep | null;
}

/** Who is looking: the asker sees their own export; anyone else sees a ready one as the asker's, and an Admin never the Owner's step. */
export function cardStateOf(page: OrganisationExportPage): ExportCardState {
  const exported = page.export;
  const fresh = page.owner ? 'idle' : 'notOwner';

  if (exported == null) return fresh;
  if (!exported.mine) return exported.state === 'ready' ? 'readyOther' : fresh;

  return exported.state;
}

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
        ],
        step: null,
      };
    case 'used':
      return {
        state,
        says: t('exportAllData.usedSays'),
        lines: [t('exportAllData.usedLine', { when: exported?.downloaded }), ...next],
        step: null,
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

/** The hub's row for Export all data: Ready for the asker until it ends, or with who asked for anyone else. */
export function exportRow(
  t: TFunction,
  page: OrganisationExportPage,
  organisation: string,
): { line: string; ready: boolean } {
  const state = cardStateOf(page);

  if (state === 'ready')
    return { line: t('dataControl.exportReadyMine', { when: page.export?.expires }), ready: true };
  if (state === 'readyOther')
    return {
      line: t('dataControl.exportReadyOther', { name: page.export?.askedBy }),
      ready: true,
    };
  if (state === 'used') return { line: t('dataControl.exportDownloaded'), ready: false };

  return { line: t('dataControl.exportIdle', { organisation }), ready: false };
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
