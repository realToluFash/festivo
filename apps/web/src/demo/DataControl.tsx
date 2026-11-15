import { formattingLocale } from '@soirely/domain';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import {
  Card,
  CardStep,
  Chevron,
  Head,
  OnCard,
  RowWords,
  Says,
  Tag,
  type Tell,
} from '../components/SettingsParts.tsx';
import { focusWhenFree } from '../layers.ts';
import { AuditLog } from './AuditLog.tsx';
import {
  type DataControlPage,
  HUB_WORDS as W,
  type HubRow,
  type HubStep,
  RUN_COUNT,
  SHARED_WORDS as S,
  dataControlPath,
  hubCard,
  hubRows,
  hubStart,
} from './dataControl.ts';
import {
  DrawnGlyph,
  type DrawnName,
  LockTag,
  PageFailed,
  PageLoading,
  SubPage,
} from './DataControlParts.tsx';
import { useLoad, useOpen } from './useDataControl.ts';
import { DataSettings } from './DataSettings.tsx';
import { EmailDomains } from './EmailDomains.tsx';
import { ExportData } from './ExportData.tsx';
import { GuestRequest } from './GuestRequest.tsx';
import type { Viewer } from './settings.ts';

const LEADS: Record<HubRow['page'], DrawnName | 'globe' | 'users'> = {
  emailDomains: 'globe',
  auditLog: 'history',
  export: 'download',
  deleteGuestData: 'schedule',
  guestRequest: 'users',
};

const STEP_WORDS: Record<HubStep, string> = {
  download: W.download,
  seeRecord: W.seeRecord,
  prove: W.prove,
  contact: S.contact,
  checkRun: W.checkRun(RUN_COUNT),
};

/** Settings › Data and control at a desk, in B · One place (Enterprise-B-*, page 28): the hub, or one of its pages. */
export function DataControl({
  page,
  viewer,
  state,
  tell,
}: {
  page: DataControlPage;
  viewer: Viewer;
  state: string;
  tell: Tell;
}) {
  const navigate = useNavigate();
  const props = { viewer, state, tell };

  switch (page) {
    case 'emailDomains':
      return <EmailDomains {...props} />;
    case 'auditLog':
      return <AuditLog {...props} />;
    case 'export':
      return <ExportData {...props} />;
    case 'guestRequest':
      return <GuestRequest {...props} />;
    case 'deleteGuestData':
      return (
        <DataSettings
          {...props}
          onBack={() => void navigate(dataControlPath('hub', viewer), { state: { landed: true } })}
        />
      );
    default:
      return <Hub {...props} />;
  }
}

function Hub({ viewer, state, tell }: { viewer: Viewer; state: string; tell: Tell }) {
  const locale = useMemo(() => formattingLocale('en', navigator.language), []);
  const [start] = useState(() => hubStart(state));
  const [load, retry] = useLoad(start.load);
  const [view, setView] = useState(start.view);
  const said = useRef<HTMLDivElement>(null);
  const open = useOpen(viewer);

  if (load !== 'loaded')
    return (
      <SubPage page="hub" title={W.title} viewer={viewer} tell={tell}>
        {load === 'failed' ? (
          <PageFailed words={W.failed} onRetry={retry} />
        ) : (
          <PageLoading words={W.loading} />
        )}
      </SubPage>
    );

  const onStep = (step: HubStep) => {
    if (step === 'download') {
      setView((now) => ({ ...now, exported: 'used' }));
      focusWhenFree(() => said.current);
    } else if (step === 'seeRecord') open('emailDomains', 'ed_record');
    else if (step === 'prove') open('emailDomains', 'ed_add');
    else if (step === 'checkRun') open('deleteGuestData', 'rt_held');
    else tell(S.contactTold);
  };
  const card = hubCard(view, viewer, locale);
  const rows = hubRows(view, viewer, locale);

  return (
    <SubPage page="hub" title={W.title} viewer={viewer} tell={tell}>
      <Card>
        <div ref={said} className="desk-said-lines" tabIndex={-1} aria-live="polite">
          <Says>{card.says}</Says>
          <OnCard>{card.line}</OnCard>
        </div>
        {card.step != null && (
          <CardStep label={STEP_WORDS[card.step]} onClick={() => card.step && onStep(card.step)} />
        )}
      </Card>
      <HubGroup title={W.control} rows={rows.control} viewer={viewer} />
      <HubGroup title={W.data} rows={rows.data} viewer={viewer} />
    </SubPage>
  );
}

function HubGroup({
  title,
  rows,
  viewer,
}: {
  title: string;
  rows: readonly HubRow[];
  viewer: Viewer;
}) {
  return (
    <section className="desk-block">
      <Head title={title} />
      <ul className="desk-rows dc-led">
        {rows.map((row) => {
          const lead = LEADS[row.page];

          return (
            <li key={row.page}>
              <Link
                className="desk-row dc-row"
                to={dataControlPath(row.page, viewer, row.state)}
                state={{ landed: true }}
              >
                <span className="dc-lead" aria-hidden="true">
                  {lead === 'globe' || lead === 'users' ? (
                    <Glyph name={lead} size={22} />
                  ) : (
                    <DrawnGlyph name={lead} />
                  )}
                </span>
                <RowWords
                  title={row.title}
                  tag={
                    row.tag === 'locked' ? (
                      <LockTag />
                    ) : (
                      row.tag === 'ready' && <Tag kind="yes" word={S.ready} />
                    )
                  }
                  lines={[row.line]}
                />
                <Chevron />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
