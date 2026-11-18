import { type Membership, type OrganisationExportPage } from '@soirely/api-client';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { DrawnGlyph, PageLoading } from '../../../components/DataControlParts.tsx';
import {
  Card,
  CardStep,
  Chevron,
  DeskPage,
  Head,
  OnCard,
  RowWords,
  Says,
  Tag,
  TextAction,
  TitleRow,
} from '../../../components/SettingsParts.tsx';
import { focusWhenFree, useDeskLayers } from '../../../layers.ts';
import { can, useSession } from '../../../session.ts';
import { Forbidden } from '../Forbidden.tsx';
import { cardStateOf, exportRow, saveArchive } from './exportAllData.ts';
import { DATA_AND_CONTROL } from './ExportAllData.tsx';
import { useOrganisationExport } from './useOrganisationExport.ts';
import '../../../components/SettingsParts.css';

/** Settings › Data and control at a desk, in B · One place (sc-612): the soonest step that asks something of the reader, then a row per job. */
export function DataAndControl() {
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;
  if (!can(session, 'organisation.manage')) return <Forbidden />;

  return <Hub key={organisation.id} organisation={organisation} />;
}

function Hub({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const { layers } = useDeskLayers();
  const { load, reload } = useOrganisationExport(organisation.id);

  return (
    <DeskPage layers={layers}>
      <div className="desk-column">
        <TitleRow title={t('dataControl.title')} />
        {load.kind === 'loading' && <PageLoading words={t('dataControl.loading')} />}
        {load.kind === 'failed' && (
          <div className="desk-failed" role="alert">
            <h2>{t('dataControl.failed')}</h2>
            <p className="desk-line">{t('dataControl.failedLine')}</p>
            <TextAction label={t('dataControl.tryAgain')} onClick={reload} />
          </div>
        )}
        {load.kind === 'loaded' && (
          <Loaded page={load.page} organisation={organisation} onDownloaded={reload} />
        )}
      </div>
    </DeskPage>
  );
}

function Loaded({
  page,
  organisation,
  onDownloaded,
}: {
  page: OrganisationExportPage;
  organisation: Membership;
  onDownloaded: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const said = useRef<HTMLDivElement>(null);
  const row = exportRow(t, page, organisation.name);
  const exported = page.export;
  const asks = cardStateOf(page) === 'ready' && exported != null;

  async function download(exportId: string, askedAt: string): Promise<void> {
    setBusy(true);

    try {
      saveArchive(
        await api.downloadOrganisationExport(organisation.id, exportId),
        organisation.name,
        askedAt,
      );
    } catch {
      // Used or ended since the page loaded: asking again shows which.
    } finally {
      setBusy(false);
      onDownloaded();
      focusWhenFree(() => said.current);
    }
  }

  return (
    <>
      {asks && (
        <Card>
          <div ref={said} className="desk-said-lines" tabIndex={-1} aria-live="polite">
            <Says>{t('exportAllData.readySays')}</Says>
            <OnCard>{t('dataControl.cardReadyLine', { when: exported.expires })}</OnCard>
          </div>
          <CardStep
            label={t('exportAllData.download')}
            busy={busy}
            onClick={() => void download(exported.id, exported.askedAt)}
          />
        </Card>
      )}
      <section className="desk-block">
        <Head title={t('dataControl.data')} />
        <ul className="desk-rows dc-led">
          <li>
            <Link className="desk-row dc-row" to={`${DATA_AND_CONTROL}/export`}>
              <span className="dc-lead" aria-hidden="true">
                <DrawnGlyph name="download" />
              </span>
              <RowWords
                title={t('exportAllData.title')}
                tag={row.ready && <Tag kind="yes" word={t('dataControl.ready')} />}
                lines={[row.line]}
              />
              <Chevron />
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}
