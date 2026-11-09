import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';

import lockupUrl from '../brand/lockup.svg';
import { useMatches } from '../phoneWidth.ts';
import { Glyph } from '../components/Glyph.tsx';
import {
  type Answer,
  COMPANIONS,
  HOLD_MS,
  LAYOUT_MEDIA,
  LEGAL,
  MESSAGE_MOST,
  MESSAGES,
  MINE_AT,
  OPEN,
  REPLY_BY,
  SEND_MS,
  TODAY,
  type View,
  type Visit,
  type Words,
  answersClosedByDate,
  characters,
  dayOf,
  forTheDay,
  layoutOf,
  sameAnswer,
  shows,
  showsMessages,
  startOf,
  twoColumns,
  wordsFor,
} from './guest.ts';
import {
  AddToCalendar,
  AnswerRows,
  Cover,
  Details,
  DoorCode,
  Filled,
  Foot,
  Gone,
  LanguageMenu,
  LanguageUnsaved,
  Line,
  Mark,
  Messages,
  Notice,
  PhaseNotice,
  TextAction,
  Thanks,
  Unreachable,
  Waiting,
} from './GuestParts.tsx';
import {
  GuestKitchenCheck,
  GuestKitchenSaved,
  GuestKitchenStep,
  GUEST_KITCHEN_SAVED_ID,
} from './GuestKitchen.tsx';
import { type GuestKitchenActions, useGuestKitchen } from './useGuestKitchen.ts';
import { useLater } from '../useLater.ts';
import { legalPath } from './legal.ts';
import './today.css';
import './settings.css';
import './events.css';
import './guest.css';

/** The guest's own page in A · The cover card, deep-linked by `?state=` (sc-31306). */
export function GuestPage() {
  const [params] = useSearchParams();
  const state = params.get('state');

  return <Visitor key={state ?? 'open'} state={state} />;
}

function useLayout() {
  return layoutOf({
    small: useMatches(LAYOUT_MEDIA.small),
    phone: useMatches(LAYOUT_MEDIA.phone),
    wide: useMatches(LAYOUT_MEDIA.wide),
    desk: useMatches(LAYOUT_MEDIA.desk),
  });
}

type Change = (was: Visit) => Partial<Visit>;

function Visitor({ state }: { state: string | null }) {
  const [visit, setVisit] = useState(() => startOf(state));
  const [retrying, setRetrying] = useState(false);
  const [saving, setSaving] = useState(false);
  const layout = useLayout();
  const words = useMemo(() => wordsFor(visit.lang), [visit.lang]);
  const later = useLater();
  const laterMessage = useLater();
  const { hash } = useLocation();

  const go = useCallback((change: Change, want?: string) => {
    setVisit((was) => ({
      ...was,
      ...change(was),
      ...(want == null ? {} : { want, wantId: was.wantId + 1 }),
    }));
  }, []);

  useEffect(() => {
    const was = document.documentElement.lang;
    document.documentElement.lang = visit.lang;

    return () => {
      document.documentElement.lang = was;
    };
  }, [visit.lang]);

  useEffect(() => {
    if (visit.want == null) return;
    document.querySelector<HTMLElement>(`.gp [data-focus="${visit.want}"]`)?.focus();
  }, [visit.want, visit.wantId]);

  const kitchen = useGuestKitchen(visit, state, go);

  const record = useCallback(
    (answer: Answer) =>
      go(
        (was) => ({
          recorded: sameAnswer(was.recorded, answer) ? was.recorded : { answer, on: TODAY },
          view: { kind: 'recorded', same: sameAnswer(was.recorded, answer) },
        }),
        'greeting',
      ),
    [go],
  );

  function sendMessage(): void {
    if (characters(visit.draft) > MESSAGE_MOST) {
      go(() => ({ draftTried: true }), 'box');
      return;
    }

    go((was) => ({
      mine: [...was.mine, { words: was.draft.trim(), at: MINE_AT, sent: false }],
      draft: '',
      draftFailed: false,
      draftTried: false,
    }));
    laterMessage(SEND_MS, () =>
      go((was) => ({ mine: was.mine.map((one) => ({ ...one, sent: true })) })),
    );
  }

  useEffect(() => {
    const hold: Record<string, () => void> = {
      sending: () => record('coming'),
      sendingTap: () => record('notComing'),
      loading: () => go(() => ({ page: 'event' })),
      replySending: () => go((was) => ({ mine: was.mine.map((one) => ({ ...one, sent: true })) })),
    };
    const land = state == null ? undefined : hold[state];
    if (land == null) return;
    const timer = setTimeout(land, HOLD_MS);

    return () => clearTimeout(timer);
  }, [state, go, record]);

  useEffect(() => {
    if (state !== 'messageArrival') return;
    const to =
      document.getElementById(hash.slice(1)) ?? document.getElementById(MESSAGES.at(-1)?.id ?? '');
    to?.scrollIntoView({ block: 'start' });
  }, [state, hash]);

  function answer(chosen: Answer): void {
    const { view } = visit;

    if (view.kind !== 'answer' && view.kind !== 'changing') return;
    if (chosen === 'coming') {
      kitchen.open(view.kind === 'changing' ? 'changing' : 'answer');
      return;
    }

    go(() => ({
      view:
        view.kind === 'answer' ? { ...view, busy: chosen, note: null } : { ...view, busy: chosen },
    }));
    later(SEND_MS, () => record(chosen));
  }

  function send(): void {
    go((was) =>
      was.view.kind === 'check' ? { view: { ...was.view, busy: true, failed: false } } : {},
    );
    later(SEND_MS, () => record('coming'));
  }

  function back(): void {
    go(
      (was) => ({
        view:
          was.view.kind === 'check' && was.view.from === 'changing'
            ? { kind: 'changing', busy: null }
            : OPEN,
      }),
      'row-coming',
    );
  }

  function tellThem(): void {
    go((was) => (was.view.kind === 'tellUs' ? { view: { ...was.view, busy: true } } : {}));
    later(SEND_MS, () =>
      go(
        (was) =>
          was.view.kind === 'tellUs'
            ? { view: { ...was.view, busy: false, result: 'thanks' } }
            : {},
        'thanks',
      ),
    );
  }

  function retry(): void {
    setRetrying(true);
    later(SEND_MS, () => {
      setRetrying(false);
      go(() => ({ page: 'event', view: OPEN }), 'h1');
    });
  }

  function saveAgain(): void {
    setSaving(true);
    later(SEND_MS, () => {
      setSaving(false);
      go(() => ({ unsaved: false }), 'lang');
    });
  }

  const closeMenu = useCallback(() => go(() => ({ menuOpen: false })), [go]);
  const two = twoColumns(layout);

  const under = (
    <Under
      visit={visit}
      words={words}
      kitchen={kitchen}
      onAnswer={answer}
      onSend={send}
      onBack={back}
      onChange={() => go(() => ({ view: { kind: 'changing', busy: null } }), 'newHead')}
      onKeep={() => go(() => ({ view: { kind: 'recorded', same: false } }), 'change')}
      onTellThem={tellThem}
      onGoBack={() =>
        go((was) => (was.view.kind === 'tellUs' ? { view: was.view.back } : {}), 'tell')
      }
      onDraft={(draft) => go(() => ({ draft }))}
      onSendMessage={sendMessage}
    />
  );

  return (
    <>
      <div className={`gp desk is-${layout}`} lang={visit.lang}>
        <header className="gp-header">
          <img className="gp-lockup" src={lockupUrl} alt="Soirely" />
          <LanguageMenu
            lang={visit.lang}
            open={visit.menuOpen}
            words={words}
            onOpen={() => go(() => ({ menuOpen: true }))}
            onClose={closeMenu}
            onChoose={(lang) =>
              go((was) => ({ lang, menuOpen: false, unsaved: false, said: was.said + 1 }), 'lang')
            }
          />
        </header>
        <p className="visually-hidden" aria-live="polite" aria-atomic="true">
          {visit.said > 0 && <span key={visit.said}>{words.switched}</span>}
        </p>
        <main id="content" className={two ? 'gp-main is-two' : 'gp-main is-one'}>
          <Body
            visit={visit}
            words={words}
            two={two}
            under={under}
            retrying={retrying}
            onRetry={retry}
            saving={saving}
            onSaveAgain={saveAgain}
            onTell={() =>
              go(
                (was) => ({ view: { kind: 'tellUs', busy: false, result: null, back: was.view } }),
                'tellHead',
              )
            }
          />
        </main>
        <footer className="gp-footer">
          <span>{words.copyright}</span>
          <span className="gp-footer-links">
            <Link to={legalPath('terms', visit.lang)}>{LEGAL[visit.lang].terms}</Link>
            <Link to={legalPath('privacy', visit.lang)}>{LEGAL[visit.lang].privacy}</Link>
          </span>
        </footer>
      </div>
      <div className="demo-way-in gp-way-in">
        <Link className="link-button" to="/demo">
          All states in the demo
        </Link>
      </div>
    </>
  );
}

function Body({
  visit,
  words,
  two,
  under,
  retrying,
  onRetry,
  saving,
  onSaveAgain,
  onTell,
}: {
  visit: Visit;
  words: Words;
  two: boolean;
  under: ReactNode;
  retrying: boolean;
  onRetry: () => void;
  saving: boolean;
  onSaveAgain: () => void;
  onTell: () => void;
}) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (box == null || !two) return;
    const height = (part: string) =>
      box.querySelector<HTMLElement>(`:scope > ${part}`)?.offsetHeight ?? 0;
    const place = () => {
      box.style.setProperty('--gpCoverH', `${height('.gp-left')}px`);
      box.style.setProperty('--gpDetailsH', `${height('.gp-left-after')}px`);
    };
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    const watch = () => {
      sizes?.disconnect();
      for (const child of box.children) sizes?.observe(child);
      place();
    };
    const children = new MutationObserver(watch);
    children.observe(box, { childList: true });
    watch();

    return () => {
      sizes?.disconnect();
      children.disconnect();
    };
  }, [box, two]);

  if (visit.page === 'gone' || visit.page === 'unreachable') {
    return (
      <div className="gp-alone-wrap">
        {visit.page === 'gone' ? (
          <Gone words={words} />
        ) : (
          <Unreachable words={words} busy={retrying} onRetry={onRetry} />
        )}
      </div>
    );
  }

  if (visit.page === 'loading') {
    return (
      <div ref={setBox} className="gp-columns" aria-busy="true">
        <p className="visually-hidden" role="status">
          {words.loading}
        </p>
        <Waiting part="cover" />
        <Waiting part="under" />
        {two && <Waiting part="details" />}
      </div>
    );
  }

  const ended = visit.phase === 'calledOff' || visit.phase === 'over' || visit.phase === 'finished';
  const { details, foot, hosts } = shows(visit);

  return (
    <div ref={setBox} className="gp-columns">
      <PhaseNotice phase={visit.phase} words={words} />
      {visit.unsaved && <LanguageUnsaved words={words} busy={saving} onRetry={onSaveAgain} />}
      <Cover visit={visit} words={words} ended={ended} />
      {under}
      {details && <Details visit={visit} words={words} hosts={hosts} />}
      {foot && <Foot words={words} onTell={onTell} />}
    </div>
  );
}

function Under({
  visit,
  words,
  kitchen,
  onAnswer,
  onSend,
  onBack,
  onChange,
  onKeep,
  onTellThem,
  onGoBack,
  onDraft,
  onSendMessage,
}: {
  visit: Visit;
  words: Words;
  kitchen: GuestKitchenActions;
  onAnswer: (answer: Answer) => void;
  onSend: () => void;
  onBack: () => void;
  onChange: () => void;
  onKeep: () => void;
  onTellThem: () => void;
  onGoBack: () => void;
  onDraft: (words: string) => void;
  onSendMessage: () => void;
}) {
  const { view } = visit;
  const thanks = visit.phase === 'finished' && view.kind === 'closed';

  return (
    <div className={thanks ? 'gp-under is-thanks' : 'gp-under'}>
      <Shown
        key={view.kind === 'tellUs' ? `tellUs-${view.result ?? ''}` : view.kind}
        view={view}
        visit={visit}
        words={words}
        kitchen={kitchen}
        onAnswer={onAnswer}
        onSend={onSend}
        onBack={onBack}
        onChange={onChange}
        onKeep={onKeep}
        onTellThem={onTellThem}
        onGoBack={onGoBack}
      />
      {showsMessages(visit) && (
        <Messages visit={visit} words={words} onDraft={onDraft} onSend={onSendMessage} />
      )}
      {forTheDay(visit) && (
        <>
          <DoorCode words={words} companions={visit.companionsComing} />
          <AddToCalendar words={words} />
        </>
      )}
    </div>
  );
}

function Shown({
  view,
  visit,
  words,
  kitchen,
  onAnswer,
  onSend,
  onBack,
  onChange,
  onKeep,
  onTellThem,
  onGoBack,
}: {
  view: View;
  visit: Visit;
  words: Words;
  kitchen: GuestKitchenActions;
  onAnswer: (answer: Answer) => void;
  onSend: () => void;
  onBack: () => void;
  onChange: () => void;
  onKeep: () => void;
  onTellThem: () => void;
  onGoBack: () => void;
}) {
  const { recorded, lang } = visit;

  switch (view.kind) {
    case 'answer':
      return (
        <section className="gp-ask" aria-labelledby="gp-answer-h">
          <h2 id="gp-answer-h" className="gp-h2">
            {words.yourAnswer}
          </h2>
          {visit.replyBy != null && !answersClosedByDate(visit) && (
            <p className="gp-sub">{words.replyBy(dayOf(REPLY_BY, lang))}</p>
          )}
          {view.note === 'unsent' && <Notice kind="attention">{words.unsent}</Notice>}
          {view.note === 'notSentTap' && <Notice kind="broken">{words.notSentTap}</Notice>}
          <AnswerRows words={words} busy={view.busy} onAnswer={onAnswer} />
        </section>
      );
    case 'kitchen':
      return <GuestKitchenStep visit={visit} words={words} actions={kitchen} />;
    case 'check':
      if (visit.kitchen != null)
        return <GuestKitchenCheck visit={visit} words={words} actions={kitchen} />;

      return (
        <section className="gp-check" aria-labelledby="gp-check-h">
          {view.refused ? (
            <Notice kind="broken">{words.refused}</Notice>
          ) : (
            <TextAction ink icon={<Glyph name="back" size={18} weight={2.2} />} onClick={onBack}>
              {words.back}
            </TextAction>
          )}
          <h2 id="gp-check-h" className="gp-h2 is-24" tabIndex={-1} data-focus="checkHead">
            {words.check}
          </h2>
          <div className="gp-row gp-check-row">
            <span className="gp-lead">
              <Mark answer="coming" />
            </span>
            <span className="gp-answer-words">{words.answerLine('coming')}</span>
            {!view.refused && <TextAction onClick={onBack}>{words.changeShort}</TextAction>}
          </div>
          {view.failed && <Notice kind="broken">{words.notSent}</Notice>}
          {!view.refused && (
            <>
              <Filled busy={view.busy} focus="send" onClick={onSend}>
                {words.send}
              </Filled>
              <p className="gp-small">{words.nothingSent}</p>
            </>
          )}
        </section>
      );
    case 'recorded': {
      if (recorded == null) return null;
      const day = dayOf(recorded.on, lang);

      return (
        <section className="gp-recorded" aria-labelledby="gp-greeting">
          <div className="gp-greet">
            <Mark answer={recorded.answer} />
            <h2 id="gp-greeting" className="gp-h2" tabIndex={-1} data-focus="greeting">
              {recorded.by == null
                ? words.greeting(recorded.answer)
                : words.answerIs(recorded.answer)}
            </h2>
          </div>
          <div className="gp-indent">
            {recorded.by == null ? (
              <p className="gp-sub">{words.answered(recorded.answer, day)}</p>
            ) : (
              <p className="gp-sub is-recorded">{words.recordedFor(recorded.by, day)}</p>
            )}
            {view.same && <p className="gp-sub is-ink">{words.same(recorded.answer)}</p>}
            {recorded.answer === 'notSure' && COMPANIONS > 0 && (
              <p className="gp-sub">{words.companions}</p>
            )}
            <TextAction focus="change" onClick={onChange}>
              {words.change}
            </TextAction>
          </div>
        </section>
      );
    }
    case 'changing':
      return (
        <section className="gp-changing" aria-labelledby="gp-new-h">
          {recorded != null && (
            <p className="gp-sub">
              {recorded.by == null
                ? words.answered(recorded.answer, dayOf(recorded.on, lang))
                : words.answerIs(recorded.answer)}
            </p>
          )}
          <h2 id="gp-new-h" className="gp-h2" tabIndex={-1} data-focus="newHead">
            {words.newAnswer}
          </h2>
          <AnswerRows
            words={words}
            current={recorded?.answer ?? null}
            busy={view.busy}
            onAnswer={onAnswer}
          />
          <TextAction focus="keep" onClick={onKeep}>
            {words.keep}
          </TextAction>
        </section>
      );
    case 'closed':
      return <Closed visit={visit} words={words} onKitchen={() => kitchen.open('closed')} />;
    case 'tellUs':
      return view.result === 'thanks' ? (
        <div className="gp-told" role="status" aria-live="polite">
          <span className="gp-mark is-coming is-28" aria-hidden="true">
            <Glyph name="tick" size={17} weight={3} />
          </span>
          <p tabIndex={-1} data-focus="thanks">
            {words.tellThanks}
          </p>
        </div>
      ) : (
        <section className="gp-tell" aria-labelledby="gp-tell-h">
          <h2 id="gp-tell-h" className="gp-h2" tabIndex={-1} data-focus="tellHead">
            {words.tellQuestion}
          </h2>
          <p className="gp-sub">{words.tellLine}</p>
          {view.result === 'failed' && <Notice kind="broken">{words.tellFailed}</Notice>}
          {view.result === 'limited' && (
            <Notice kind="attention" alert>
              {words.tellLimited}
            </Notice>
          )}
          <Filled busy={view.busy} focus="tellThem" onClick={onTellThem}>
            {words.tellThem}
          </Filled>
          <button className="gp-outlined" type="button" onClick={onGoBack}>
            {words.goBack}
          </button>
        </section>
      );
  }
}

/** Answers closed: by the date to answer by, at the start, by a pause, or with the event over. */
function Closed({
  visit,
  words,
  onKitchen,
}: {
  visit: Visit;
  words: Words;
  onKitchen: () => void;
}) {
  const { recorded, phase, lang } = visit;
  const said =
    recorded == null
      ? words.didNotAnswer
      : recorded.by != null
        ? words.answerIs(recorded.answer)
        : words.answered(recorded.answer, dayOf(recorded.on, lang));

  if (phase === 'calledOff') return null;
  if (phase === 'over' || phase === 'finished') {
    return (
      <div className="gp-ended">
        {phase === 'finished' && <Thanks words={words} />}
        <p className="gp-sub">{said}</p>
      </div>
    );
  }

  if (phase === 'paused') {
    return (
      <section className="gp-closed" aria-labelledby="gp-closed-h">
        <h2 id="gp-closed-h" className="gp-h2 is-19">
          {said}
        </h2>
        {!visit.started && (
          <>
            <TextAction off focus="change" describedBy="gp-reason">
              {words.change}
            </TextAction>
            <p id="gp-reason" className="gp-sub">
              {words.pausedReason}
            </p>
          </>
        )}
      </section>
    );
  }

  const by = dayOf(visit.replyBy ?? '', lang);
  const saved = visit.kitchen?.saved === true;
  const line =
    visit.started || !answersClosedByDate(visit)
      ? words.closed
      : recorded == null || recorded.answer === 'notSure'
        ? words.closedByNotSure(by)
        : words.closedBy(by);

  return (
    <section className="gp-closed is-live" aria-labelledby="gp-closed-h">
      <h2 id="gp-closed-h" className="gp-h2 is-19">
        {said}
      </h2>
      {recorded?.by != null && (
        <p className="gp-sub is-recorded">
          {words.recordedOn(recorded.by, dayOf(recorded.on, lang))}
        </p>
      )}
      {saved && <GuestKitchenSaved lang={lang} />}
      <p className="gp-sub">{line}</p>
      {!visit.started && recorded?.answer === 'coming' && (
        <TextAction
          focus="kitchen"
          {...(saved ? { describedBy: GUEST_KITCHEN_SAVED_ID } : {})}
          icon={<Line name="pencil" size={18} weight={2.2} />}
          onClick={onKitchen}
        >
          {words.kitchen}
        </TextAction>
      )}
    </section>
  );
}
