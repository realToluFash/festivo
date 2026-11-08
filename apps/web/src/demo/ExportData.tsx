import { formattingLocale } from '@soirely/domain';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Card,
  CardStep,
  Head,
  OnCard,
  RowWords,
  Says,
  type Tell,
} from '../components/SettingsParts.tsx';
import { focusWhenFree } from '../layers.ts';
import { PageFailed, PageLoading, StatusLine, SubPage } from './DataControlParts.tsx';
import { useLoad } from './useDataControl.ts';
import { zoneFor } from './dataControl.ts';
import {
  EXPORT_WORDS as W,
  type ExportState,
  type ExportStep,
  afterStep,
  exportCard,
  exportFor,
  exportStateOf,
  limitedLine,
} from './exportData.ts';
import type { Viewer } from './settings.ts';

const PREPARING_MS = 2000;

/** Data and control › Export all data (sc-612): one archive, asked by an owner, downloaded once by them. */
export function ExportData({ viewer, state, tell }: { viewer: Viewer; state: string; tell: Tell }) {
  const locale = useMemo(() => formattingLocale('en', navigator.language), []);
  const zone = zoneFor(viewer);
  const [start] = useState(() => exportStateOf(state));
  const [load, retry] = useLoad(start === 'loading' || start === 'failed' ? start : 'loaded');
  const [now, setNow] = useState<ExportState>(() =>
    exportFor(start === 'loading' || start === 'failed' ? 'ex_idle' : start, viewer.owns),
  );
  const [played, setPlayed] = useState(false);
  const said = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!played || now !== 'ex_preparing') return;
    const timer = setTimeout(() => setNow('ex_ready'), PREPARING_MS);

    return () => clearTimeout(timer);
  }, [played, now]);

  if (load !== 'loaded')
    return (
      <SubPage page="export" title={W.title} viewer={viewer} tell={tell}>
        {load === 'failed' ? (
          <PageFailed words={W.failed} onRetry={retry} />
        ) : (
          <PageLoading words={W.loading} />
        )}
      </SubPage>
    );

  const card = exportCard(now, locale, zone);
  const labels: Record<ExportStep, string> = {
    export: W.export,
    download: W.download,
    retry: W.tryAgain,
  };

  return (
    <SubPage page="export" title={W.title} viewer={viewer} tell={tell}>
      {now === 'ex_used_link' && <StatusLine kind="ended">{W.usedLink}</StatusLine>}
      {now === 'ex_limited' && (
        <StatusLine kind="refused" alert>
          {limitedLine(locale, zone)}
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
            onClick={() => {
              if (card.step == null) return;
              setPlayed(true);
              setNow(afterStep(card.step));
              focusWhenFree(() => said.current);
            }}
          />
        )}
      </Card>
      <section className="desk-block">
        <Head title={W.holds} />
        <ul className="desk-rows">
          {W.rows.map((row) => (
            <li key={row} className="desk-row is-plain">
              <RowWords title={row} />
            </li>
          ))}
        </ul>
        <p className="desk-foot">{W.foot}</p>
      </section>
    </SubPage>
  );
}
