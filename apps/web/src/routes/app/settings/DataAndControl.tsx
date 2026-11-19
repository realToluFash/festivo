import {
  type EmailDomainsPage,
  type Membership,
  type OrganisationExportPage,
} from '@soirely/api-client';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { DrawnGlyph, LockTag, PageLoading } from '../../../components/DataControlParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
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
import { domainsRow, soonestAsk } from './emailDomains.ts';
import { EMAIL_DOMAINS } from './EmailDomains.tsx';
import { exportRow, saveArchive } from './exportAllData.ts';
import { DATA_AND_CONTROL } from './ExportAllData.tsx';
import { useEmailDomains } from './useEmailDomains.ts';
import { useOrganisationExport } from './useOrganisationExport.ts';
import '../../../components/SettingsParts.css';

/** Settings › Data and control at a desk, in B · One place (sc-612): a card with the soonest step that asks something of the reader, or that nothing does (ux #68069), then a row per job. */
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
  const exported = useOrganisationExport(organisation.id);
  const domains = useEmailDomains(organisation.id);
  const failed = exported.load.kind === 'failed' || domains.load.kind === 'failed';
  const reload = () => {
    exported.reload();
    domains.reload();
  };

  return (
    <DeskPage layers={layers}>
      <div className="desk-column">
        <TitleRow title={t('dataControl.title')} />
        {!failed && (exported.load.kind === 'loading' || domains.load.kind === 'loading') && (
          <PageLoading words={t('dataControl.loading')} />
        )}
        {failed && (
          <div className="desk-failed" role="alert">
            <h2>{t('dataControl.failed')}</h2>
            <p className="desk-line">{t('dataControl.failedLine')}</p>
            <TextAction label={t('dataControl.tryAgain')} onClick={reload} />
          </div>
        )}
        {exported.load.kind === 'loaded' && domains.load.kind === 'loaded' && (
          <Loaded
            page={exported.load.page}
            domains={domains.load.page}
            organisation={organisation}
            onDownloaded={exported.reload}
          />
        )}
      </div>
    </DeskPage>
  );
}

function Loaded({
  page,
  domains,
  organisation,
  onDownloaded,
}: {
  page: OrganisationExportPage;
  domains: EmailDomainsPage;
  organisation: Membership;
  onDownloaded: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const said = useRef<HTMLDivElement>(null);
  const row = exportRow(t, page, organisation.name);
  const domainsLine = domainsRow(t, domains);
  const exported = page.export;
  const ask = soonestAsk(t, page, domains);

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
      <Card>
        <div ref={said} className="desk-said-lines" tabIndex={-1} aria-live="polite">
          {ask != null ? (
            <>
              <Says>{ask.says}</Says>
              <OnCard>{ask.line}</OnCard>
            </>
          ) : (
            <Says>{t('dataControl.nothingAsks')}</Says>
          )}
        </div>
        {ask?.does === 'download' && exported != null && (
          <CardStep
            label={t('exportAllData.download')}
            busy={busy}
            onClick={() => void download(exported.id, exported.askedAt)}
          />
        )}
        {ask?.does === 'record' && (
          <CardStep
            label={t('emailDomains.seeRecord')}
            onClick={() =>
              void navigate(`${EMAIL_DOMAINS}?${new URLSearchParams({ record: ask.domain })}`)
            }
          />
        )}
      </Card>
      <section className="desk-block">
        <Head title={t('dataControl.control')} />
        <ul className="desk-rows dc-led">
          <li>
            <Link className="desk-row dc-row" to={EMAIL_DOMAINS}>
              <span className="dc-lead" aria-hidden="true">
                <Glyph name="globe" size={22} />
              </span>
              <RowWords
                title={t('emailDomains.title')}
                tag={domainsLine.locked && <LockTag word={t('dataControl.enterprise')} />}
                lines={[domainsLine.line]}
              />
              <Chevron />
            </Link>
          </li>
        </ul>
      </section>
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
