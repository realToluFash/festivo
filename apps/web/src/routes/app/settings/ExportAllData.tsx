import { ApiError, type Membership, type OrganisationExportPage } from '@soirely/api-client';
import { type RefObject, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { api } from '../../../api.ts';
import { PageLoading, StatusLine } from '../../../components/DataControlParts.tsx';
import {
  BackRow,
  Card,
  CardStep,
  DeskPage,
  Head,
  OnCard,
  RowWords,
  Says,
  TextAction,
  TitleRow,
} from '../../../components/SettingsParts.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { focusWhenFree, useDeskLayers } from '../../../layers.ts';
import { can, useSession } from '../../../session.ts';
import { Forbidden } from '../Forbidden.tsx';
import { type ExportStep, exportCard, saveArchive } from './exportAllData.ts';
import { useOrganisationExport } from './useOrganisationExport.ts';
import '../../../components/SettingsParts.css';

export const DATA_AND_CONTROL = '/app/settings/data-and-control';

/** What happened on this page that the card alone does not say: a used link, or the daily limit's 429. */
type Told = { kind: 'usedLink' } | { kind: 'limited'; when: string } | null;

/** Data and control › Export all data at a desk (sc-612), as the design demo's /demo/settings/data-and-control/export draws it. */
export function ExportAllData() {
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;
  if (!can(session, 'organisation.manage')) return <Forbidden />;

  return <ExportDesk key={organisation.id} organisation={organisation} email={session.email} />;
}

function ExportDesk({ organisation, email }: { organisation: Membership; email: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const desk = useDeskTop();
  const { layers } = useDeskLayers();
  const [search, setSearch] = useSearchParams();
  const { load, show, reload } = useOrganisationExport(organisation.id);
  const [told, setTold] = useState<Told>(null);
  const [busy, setBusy] = useState(false);
  const said = useRef<HTMLDivElement>(null);
  const linked = useRef(search.get('download'));

  const back = () => void navigate(DATA_AND_CONTROL);

  async function download(exportId: string, askedAt: string): Promise<void> {
    setBusy(true);
    setTold(null);

    try {
      saveArchive(
        await api.downloadOrganisationExport(organisation.id, exportId),
        organisation.name,
        askedAt,
      );
    } catch (error) {
      if (error instanceof ApiError && error.is('export_used')) setTold({ kind: 'usedLink' });
    } finally {
      setBusy(false);
      reload();
      focusWhenFree(() => said.current);
    }
  }

  const followLink = useEffectEvent((exportId: string) => {
    setSearch({}, { replace: true });
    void download(exportId, new Date().toISOString());
  });

  useEffect(() => {
    const exportId = linked.current;
    if (exportId == null) return;
    linked.current = null;
    followLink(exportId);
  }, []);

  async function ask(): Promise<void> {
    setBusy(true);
    setTold(null);

    try {
      show(await api.askOrganisationExport(organisation.id));
    } catch (error) {
      if (error instanceof ApiError && error.is('too_many_attempts'))
        setTold({ kind: 'limited', when: error.problem.retryAt ?? '' });
      reload();
    } finally {
      setBusy(false);
      focusWhenFree(() => said.current);
    }
  }

  const onStep = (page: OrganisationExportPage, step: ExportStep) => {
    const exported = page.export;
    if (step === 'download' && exported != null) void download(exported.id, exported.askedAt);
    else void ask();
  };

  return (
    <DeskPage layers={layers}>
      <div className="desk-column">
        <BackRow to={t('dataControl.title')} onBack={back} bell={desk.bell} />
        <TitleRow title={t('exportAllData.title')} />
        {load.kind === 'loading' && <PageLoading words={t('exportAllData.loading')} />}
        {load.kind === 'failed' && (
          <div className="desk-failed" role="alert">
            <h2>{t('exportAllData.failed')}</h2>
            <p className="desk-line">{t('dataControl.failedLine')}</p>
            <TextAction label={t('dataControl.tryAgain')} onClick={reload} />
          </div>
        )}
        {load.kind === 'loaded' && (
          <Loaded
            page={load.page}
            organisation={organisation.name}
            email={email}
            told={told}
            busy={busy}
            said={said}
            onStep={(step) => onStep(load.page, step)}
          />
        )}
      </div>
    </DeskPage>
  );
}

function Loaded({
  page,
  organisation,
  email,
  told,
  busy,
  said,
  onStep,
}: {
  page: OrganisationExportPage;
  organisation: string;
  email: string;
  told: Told;
  busy: boolean;
  said: RefObject<HTMLDivElement | null>;
  onStep: (step: ExportStep) => void;
}) {
  const { t } = useTranslation();
  const card = exportCard(t, page, organisation, email);
  const labels: Record<ExportStep, string> = {
    export: t('exportAllData.export'),
    download: t('exportAllData.download'),
    retry: t('dataControl.tryAgain'),
  };
  const rows = [
    t('exportAllData.holdsOrganisation'),
    t('exportAllData.holdsMembers'),
    t('exportAllData.holdsEvents'),
    t('exportAllData.holdsGuests'),
  ];

  return (
    <>
      {told?.kind === 'usedLink' && (
        <StatusLine kind="ended">{t('exportAllData.usedLink')}</StatusLine>
      )}
      {told?.kind === 'limited' && (
        <StatusLine kind="refused" alert>
          {t('exportAllData.limited', { when: told.when })}
        </StatusLine>
      )}
      <Card>
        <div ref={said} className="desk-said-lines" tabIndex={-1} aria-live="polite">
          <Says>{card.says}</Says>
          {card.lines.map((line) => (
            <OnCard key={line}>{line}</OnCard>
          ))}
        </div>
        {card.step != null && (
          <CardStep
            label={labels[card.step]}
            busy={busy}
            onClick={() => card.step != null && onStep(card.step)}
          />
        )}
      </Card>
      <section className="desk-block">
        <Head title={t('exportAllData.holds')} />
        <ul className="desk-rows">
          {rows.map((row) => (
            <li key={row} className="desk-row is-plain">
              <RowWords title={row} />
            </li>
          ))}
        </ul>
        <p className="desk-foot">{t('exportAllData.foot')}</p>
      </section>
    </>
  );
}
