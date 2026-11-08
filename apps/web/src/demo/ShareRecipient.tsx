import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import lockupUrl from '../brand/lockup.svg';
import { Glyph } from '../components/Glyph.tsx';
import { useMatches } from '../phoneWidth.ts';
import { LAYOUT_MEDIA, LEGAL, type Lang, layoutOf, twoColumns, wordsFor } from './guest.ts';
import { LanguageMenu, TextAction } from './GuestParts.tsx';
import { legalPath } from './legal.ts';
import {
  EVENT_NAME,
  LOCKED_UNTIL,
  type Shared,
  UPDATED_LINE,
  type Visit,
  answerTo,
  sharedView,
  timeOf,
  visitOf,
} from './share.ts';
import { SHARE_WORDS as W } from './shareWords.ts';
import { sampleEvent } from './events.ts';
import { BUDGET_EVENT } from './budget.ts';
import './today.css';
import './settings.css';
import './events.css';
import './guest.css';
import './share.css';

const MESH = sampleEvent(BUDGET_EVENT)?.mesh ?? 'wed';
const PIECES = [1, 2, 3, 4, 5, 6, 7];

/** The page a payer, a client or a committee opens from a link, signed out, in the guest page A's frame (sc-94, sc-1300). */
export function ShareRecipient() {
  const { scope } = useParams();
  const [params] = useSearchParams();
  const state = params.get('state');

  return <Recipient key={`${scope ?? ''}|${state ?? ''}`} path={scope} state={state} />;
}

function useLayout() {
  return layoutOf({
    small: useMatches(LAYOUT_MEDIA.small),
    phone: useMatches(LAYOUT_MEDIA.phone),
    wide: useMatches(LAYOUT_MEDIA.wide),
    desk: useMatches(LAYOUT_MEDIA.desk),
  });
}

function Recipient({ path, state }: { path: string | undefined; state: string | null }) {
  const [visit, setVisit] = useState<Visit>(() => visitOf(path, state));
  const [lang, setLang] = useState<Lang>('en');
  const [menuOpen, setMenuOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const layout = useLayout();
  const two = twoColumns(layout);
  const frame = useMemo(() => wordsFor(lang), [lang]);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (opened) document.getElementById('sh-h1')?.focus();
  }, [opened]);

  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <div className={`gp desk sh is-${layout}`} lang={lang}>
        <header className="gp-header">
          <img className="gp-lockup" src={lockupUrl} alt="Soirely" />
          <LanguageMenu
            lang={lang}
            open={menuOpen}
            words={frame}
            onOpen={() => setMenuOpen(true)}
            onClose={closeMenu}
            onChoose={(chosen) => {
              setLang(chosen);
              setMenuOpen(false);
            }}
          />
        </header>
        <main id="content" lang="en" className={two ? 'gp-main is-two' : 'gp-main is-one'}>
          {visit.page === 'ended' ? (
            <div className="gp-alone-wrap">
              <h1 className="sh-gone-title">{W.endedTitle}</h1>
              <p className="sh-gone-line">{W.endedLine(visit.by)}</p>
            </div>
          ) : visit.page === 'gone' ? (
            <div className="gp-alone-wrap">
              <h1 className="sh-gone-title">{W.goneTitle}</h1>
              <p className="sh-gone-line">{W.goneLine}</p>
            </div>
          ) : visit.page === 'gate' ? (
            <Gate
              visit={visit}
              onAnswer={(typed) => {
                const answer = answerTo(typed, visit.wrong);
                if (answer === 'open') {
                  setVisit({ page: 'shown', scope: visit.scope, marked: false });
                  setOpened(true);
                  return;
                }
                setVisit({
                  ...visit,
                  wrong: answer === 'wrong' ? visit.wrong + 1 : visit.wrong,
                  answer,
                  tried: typed,
                });
              }}
            />
          ) : (
            <Shown view={sharedView(visit.scope, visit.marked)} />
          )}
        </main>
        <footer className="gp-footer">
          <span>{frame.copyright}</span>
          <span className="gp-footer-links">
            <Link to={legalPath('terms', lang)}>{LEGAL[lang].terms}</Link>
            <Link to={legalPath('privacy', lang)}>{LEGAL[lang].privacy}</Link>
          </span>
        </footer>
      </div>
      <div className="demo-way-in gp-way-in sh-way-in">
        <Link className="link-button" to="/demo">
          {W.allStates}
        </Link>
      </div>
    </>
  );
}

function Shown({ view }: { view: Shared }) {
  return (
    <div className="sh-columns">
      <section className={`sh-cover ev-card today-cover is-${MESH}`} aria-labelledby="sh-h1">
        <span className="ev-scrim" aria-hidden="true" />
        {PIECES.map((piece) => (
          <span key={piece} className={`gp-piece p${piece}`} aria-hidden="true" />
        ))}
        <div className="sh-cover-inner">
          <h1 id="sh-h1" className="sh-cover-title" tabIndex={-1}>
            {view.title}
          </h1>
          <p className="sh-cover-name">{view.name}</p>
          <p className="sh-cover-line">{UPDATED_LINE}</p>
        </div>
      </section>
      <div className="sh-rest">
        {view.label != null && <p className="sh-label">{view.label}</p>}
        <p className="sh-figure">{view.figure}</p>
        <p className="sh-sentence">{view.sentence}</p>
        {view.blocks.map((block, index) => (
          <section
            key={index}
            className={block.loose === true ? 'sh-block is-loose' : 'sh-block'}
            aria-labelledby={block.head == null ? undefined : `sh-block-${index}`}
          >
            {block.head != null && (
              <h2 id={`sh-block-${index}`} className="sh-h2">
                {block.head}
              </h2>
            )}
            <dl className="sh-rows">
              {block.rows.map((row) => (
                <div key={row.title} className="sh-row">
                  <dt>
                    <span className="sh-row-title">{row.title}</span>
                    {row.line != null && <span className="sh-row-line">{row.line}</span>}
                  </dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <div className="sh-print">
          <TextAction icon={<PrintLine />} onClick={() => window.print()}>
            {W.print}
          </TextAction>
        </div>
      </div>
    </div>
  );
}

/** The board's print stroke, drawn as GuestParts' lines are: beside its word, so hidden. */
function PrintLine() {
  return (
    <svg
      className="gp-line"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      strokeWidth={2.2}
    >
      <path d="M6 9V2h12v7" />
      <rect x={6} y={14} width={12} height={8} rx={1} />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}

function Gate({
  visit,
  onAnswer,
}: {
  visit: Extract<Visit, { page: 'gate' }>;
  onAnswer: (typed: string) => void;
}) {
  const [typed, setTyped] = useState(visit.tried);
  const [tries, setTries] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const error =
    visit.answer === 'wrong'
      ? W.wrongPassphrase
      : visit.answer === 'locked'
        ? W.tooMany(timeOf(LOCKED_UNTIL))
        : null;

  useEffect(() => field.current?.focus(), []);

  function submit(event: FormEvent): void {
    event.preventDefault();
    setTries((was) => was + 1);
    onAnswer(typed);
    field.current?.focus();
  }

  return (
    <div className="gp-alone-wrap sh-gate">
      <p className="sh-gate-event">{EVENT_NAME}</p>
      <h1 className="sh-gate-title">{W.asksTitle}</h1>
      <p className="sh-gate-line">{W.asksLine}</p>
      <form className="sh-gate-form" noValidate onSubmit={submit}>
        <div className="sh-field">
          <label htmlFor="sh-passphrase">{W.passphrase}</label>
          <div className={error == null ? 'sh-box' : 'sh-box is-wrong'}>
            <input
              ref={field}
              id="sh-passphrase"
              type="password"
              value={typed}
              spellCheck={false}
              aria-invalid={error != null}
              aria-describedby={error == null ? undefined : 'sh-passphrase-error'}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
          {error != null && (
            <p key={tries} id="sh-passphrase-error" className="gp-error" role="alert">
              <Glyph name="alert" size={15} weight={2.2} />
              {error}
            </p>
          )}
        </div>
        <button type="submit" className="gp-filled">
          {W.open}
        </button>
      </form>
    </div>
  );
}
