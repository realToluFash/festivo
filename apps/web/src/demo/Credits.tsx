import { formattingLocale } from '@soirely/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { BackRow, type Tell, TextAction, TitleRow } from '../components/SettingsParts.tsx';
import {
  BILLING_PATH,
  CARD_LINES,
  CREDITS_PATH,
  CREDITS_WORDS,
  type CreditsPageState,
  FEW_ENTRIES,
  type Lang,
  type Line,
  PAGE_LINES,
  SAMPLE_ENTRIES,
  creditsPageStateOf,
  langOf,
  ledgerLines,
  lineDate,
  moreShownSaid,
  signedCredits,
} from './credits.ts';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { SIDEBAR_EVENTS } from './settings.ts';
import { TodaySidebar } from './TodaySidebar.tsx';
import './billing.css';

const LOAD_MS = 900;

export function LedgerRows({
  lines,
  lang,
  locale,
  dropped,
  firstAdded,
}: {
  lines: readonly Line[];
  lang: Lang;
  locale: string;
  dropped?: string | null | undefined;
  firstAdded?: number | undefined;
}) {
  return (
    <ul className="desk-rows bl-ledger">
      {lines.map((line, index) => (
        <li
          key={line.id}
          className={line.id === dropped ? 'bl-entry is-new' : 'bl-entry'}
          tabIndex={index === firstAdded ? -1 : undefined}
        >
          <span className="bl-entry-day">{lineDate(line.at, locale)}</span>
          <span className="bl-entry-words">{line.words(lang, locale)}</span>
          <span className="bl-entry-amount">{signedCredits(line.credits, locale)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Under the balance: the last 10 lines, and All credit entries only when there are more. No entry at all draws nothing. */
export function CardLedger({
  lines,
  lang,
  locale,
  dropped,
}: {
  lines: readonly Line[];
  lang: Lang;
  locale: string;
  dropped: string | null;
}) {
  const w = CREDITS_WORDS[lang];
  if (lines.length === 0) return null;

  return (
    <>
      <h3 className="bl-sub">{w.recent}</h3>
      <LedgerRows
        lines={lines.slice(0, CARD_LINES)}
        lang={lang}
        locale={locale}
        dropped={dropped}
      />
      {lines.length > CARD_LINES && (
        <Link
          className="desk-text bl-all"
          to={`${CREDITS_PATH}${lang === 'fr' ? '?lang=fr' : ''}`}
          state={{ fromBilling: true }}
        >
          {w.all}
          <Glyph name="chevron" size={16} weight={2.4} />
        </Link>
      )}
    </>
  );
}

export function LedgerBones({ rows }: { rows: number }) {
  return (
    <ul className="desk-rows bl-ledger" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="bl-entry is-bones">
          <span className="desk-sunk is-line b1" />
          <span className={`desk-sunk is-line b${(index % 3) + 1}`} />
          <span className="desk-sunk is-line bl-bone-amount" />
        </li>
      ))}
    </ul>
  );
}

/** Settings › Plan and billing › All credit entries (sc-99054), on sample data. */
export function AllCredits() {
  const [params] = useSearchParams();
  const raw = params.get('state');
  const lang = langOf(params.get('lang'));

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <TodaySidebar events={SIDEBAR_EVENTS} tell={tell} settings inert={covered} />
      )}
    >
      {(tell) => (
        <CreditsPage
          key={`${raw ?? ''}:${lang}`}
          state={creditsPageStateOf(raw)}
          lang={lang}
          tell={tell}
        />
      )}
    </EventsShell>
  );
}

type Phase = 'loading' | 'failed' | 'loaded';

function entriesFor(state: CreditsPageState) {
  if (state === 'empty') return [];
  if (state === 'few') return FEW_ENTRIES;

  return SAMPLE_ENTRIES;
}

function CreditsPage({ state, lang, tell }: { state: CreditsPageState; lang: Lang; tell: Tell }) {
  const w = CREDITS_WORDS[lang];
  const locale = useMemo(() => formattingLocale(lang, navigator.language), [lang]);
  const lines = useMemo(() => ledgerLines(entriesFor(state)), [state]);
  const navigate = useNavigate();
  const location = useLocation() as { state: { fromBilling?: boolean } | null };
  const [phase, setPhase] = useState<Phase>(
    state === 'loading' ? 'loading' : state === 'failed' ? 'failed' : 'loaded',
  );
  const [shown, setShown] = useState(PAGE_LINES);
  const [busy, setBusy] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [said, setSaid] = useState('');
  const [firstAdded, setFirstAdded] = useState<number | undefined>(undefined);
  const failsLeft = useRef(state === 'more_fails' ? 1 : 0);
  const list = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (firstAdded == null) return;
    if (shown >= lines.length)
      list.current?.querySelectorAll<HTMLElement>('.bl-entry')[firstAdded]?.focus();
  }, [firstAdded, shown, lines.length]);

  const retry = () => {
    setPhase('loading');
    setTimeout(() => setPhase('loaded'), LOAD_MS);
  };

  const showMore = () => {
    if (busy) return;
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      if (failsLeft.current > 0) {
        failsLeft.current -= 1;
        setMoreFailed(true);
        return;
      }
      const added = Math.min(PAGE_LINES, lines.length - shown);
      setMoreFailed(false);
      setFirstAdded(shown);
      setShown(shown + added);
      setSaid(moreShownSaid(added, lang, locale));
    }, LOAD_MS);
  };

  const back = () => {
    if (location.state?.fromBilling === true) void navigate(-1);
    else void navigate(`${BILLING_PATH}${lang === 'fr' ? '?lang=fr' : ''}`);
  };

  return (
    <div className="desk-page">
      <div className="desk-column bl">
        <BackRow to={w.title} onBack={back} bell={<DemoBell tell={tell} />} />
        <TitleRow title={w.all} underBack />
        <p className="bl-said" role="status" aria-live="polite">
          {said}
        </p>

        {phase === 'loading' && (
          <div className="desk-loading" role="status" aria-label={w.loading}>
            <p className="bl-loading">
              <span className="pending-spinner" aria-hidden="true" />
              {w.loading}
            </p>
            <LedgerBones rows={8} />
          </div>
        )}

        {phase === 'failed' && (
          <div className="desk-failed" role="alert">
            <h2>{w.failed}</h2>
            <p className="desk-line">{w.failedLine}</p>
            <TextAction label={w.tryAgain} onClick={retry} />
          </div>
        )}

        {phase === 'loaded' && lines.length === 0 && <p className="desk-line">{w.none}</p>}

        {phase === 'loaded' && lines.length > 0 && (
          <div ref={list} className="desk-block bl-card">
            <LedgerRows
              lines={lines.slice(0, shown)}
              lang={lang}
              locale={locale}
              firstAdded={firstAdded}
            />
            {(shown < lines.length || moreFailed) && (
              <div className="bl-more">
                {moreFailed && (
                  <p className="bl-more-failed" role="alert">
                    <Glyph name="alert" size={16} weight={2.2} />
                    {w.moreFailed}
                  </p>
                )}
                {shown < lines.length && (
                  <button
                    ref={more}
                    type="button"
                    className="desk-text"
                    aria-disabled={busy}
                    aria-busy={busy}
                    onClick={showMore}
                  >
                    {w.showMore}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {phase === 'loading' && state === 'loading' && (
          <div className="bl-demo-only">
            <p>Stand-in for the read finishing, in the demo only.</p>
            <button type="button" className="desk-text" onClick={() => setPhase('loaded')}>
              The entries load
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
