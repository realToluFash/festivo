import { DemoBell } from './DemoBell.tsx';
import { formattingLocale } from '@soirely/domain';
import { type ReactNode, type RefObject, useEffect, useId, useMemo, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import {
  Ask,
  Card,
  CardStep,
  Choices,
  Dialog,
  Field,
  Head,
  Note,
  OnCard,
  RowWords,
  Says,
  type Tell,
  TextAction,
  TitleRow,
} from '../components/SettingsParts.tsx';
import { focusWhenFree } from '../layers.ts';
import {
  DATA_WORDS as W,
  type DataPage,
  type Hold,
  ON_PERIODS,
  type OnPeriod,
  PERIODS,
  type PastEvent,
  type Period,
  type Question,
  REFUSALS,
  type ReaderZone,
  type Refusal,
  cardOf,
  dataStart,
  endedWords,
  heldBack,
  heldLine,
  isBlank,
  nextRunLine,
  questionOf,
  released,
  turnedOff,
  withPeriod,
} from './dataSettings.ts';
import type { Load } from './members.ts';
import type { Viewer } from './settings.ts';
import './dataSettings.css';

const RETRY_MS = 1200;

/** Settings > Data at a desk in B · Summary first (DataSettings.dc.html), the retention part; sc-612's export joins above it. */
export function DataSettings({
  viewer,
  state,
  tell,
}: {
  viewer: Viewer;
  state: string;
  tell: Tell;
}) {
  const locale = useMemo(() => formattingLocale('en', navigator.language), []);
  const [start] = useState(() => dataStart(state, viewer, locale));
  const [load, setLoad] = useState<Load | 'retrying'>(start.load);
  const [page, setPage] = useState(start.page);
  const [asking, setAsking] = useState(start.asking);
  const [holding, setHolding] = useState(start.holding);
  const [menu, setMenu] = useState(false);
  const period = useRef<HTMLButtonElement>(null);
  const zone = start.zone;

  useEffect(() => {
    if (load !== 'retrying') return;
    const timer = setTimeout(() => setLoad('loaded'), RETRY_MS);

    return () => clearTimeout(timer);
  }, [load]);

  if (load !== 'loaded')
    return (
      <Page>
        <TitleRow title={W.title} bell={<DemoBell tell={tell} />} />
        {load === 'failed' ? <Failed onRetry={() => setLoad('retrying')} /> : <Loading />}
      </Page>
    );

  const locked = page.plan !== 'enterprise';
  const card = cardOf(page, viewer);
  const changes = viewer.owns && !locked;
  const toSaid = () =>
    focusWhenFree(() => document.querySelector<HTMLElement>('.desk-main .desk-said-lines'));
  const backToPeriod = () => focusWhenFree(() => period.current);
  const pick = (picked: Period) => {
    setMenu(false);
    if (picked === page.period) return;
    if (picked === 'Off') setPage(turnedOff(page));
    else setAsking(picked);
  };

  return (
    <Page>
      <TitleRow title={W.title} bell={<DemoBell tell={tell} />} />
      <Card>
        <div className="desk-said-lines" tabIndex={-1} aria-live="polite">
          <Says>{card.says}</Says>
          <OnCard>{card.line}</OnCard>
        </div>
        {card.step === 'contact' && (
          <CardStep label={W.contact} onClick={() => tell(W.contactTold)} />
        )}
        {card.step === 'choose' && <CardStep label={W.choose} onClick={() => setMenu(true)} />}
      </Card>
      <section className="desk-block">
        <Head title={W.setting}>
          {locked && (
            <span className="desk-tag">
              <Glyph name="lock" size={13} weight={2.4} />
              {W.locked}
            </span>
          )}
          {changes ? (
            <PeriodMenu
              period={page.period}
              button={period}
              open={menu}
              onOpen={() => setMenu(true)}
              onClose={() => setMenu(false)}
              onPick={pick}
            />
          ) : (
            <span className="data-value">{page.period}</span>
          )}
        </Head>
        <p className="desk-foot">{W.counted}</p>
        {!changes && !locked && <p className="desk-foot">{W.ownerOnly}</p>}
      </section>
      {!locked && page.runAt != null && (
        <section className="desk-block">
          <Head title={nextRunLine(page.runAt, zone, locale)} />
          <NextRun
            run={page.run}
            zone={zone}
            locale={locale}
            onHold={(event) => setHolding(event)}
          />
          {page.run.length > 0 && <p className="desk-foot">{W.holdFoot}</p>}
        </section>
      )}
      {!locked && page.held.length > 0 && (
        <section className="desk-block">
          <Head title={W.held} />
          <HeldBack
            held={page.held}
            zone={zone}
            locale={locale}
            onRelease={(hold) => {
              setPage(released(page, hold, zone, locale));
              toSaid();
            }}
          />
          <p className="desk-foot">{W.releaseFoot}</p>
        </section>
      )}
      {asking != null && (
        <QuestionDialog
          page={page}
          asking={asking}
          question={questionOf(page, asking, zone, locale)}
          refusal={start.refusal}
          zone={zone}
          locale={locale}
          onPick={setAsking}
          onContact={() => tell(W.contactTold)}
          onCancel={() => {
            setAsking(null);
            backToPeriod();
          }}
          onConfirm={() => {
            setPage(withPeriod(page, asking));
            setAsking(null);
            toSaid();
          }}
        />
      )}
      {holding != null && (
        <HoldDialog
          event={holding}
          startsBlank={start.blank}
          zone={zone}
          locale={locale}
          onCancel={() => setHolding(null)}
          onHold={(reason) => {
            setPage(heldBack(page, holding, reason, viewer.name));
            setHolding(null);
            toSaid();
          }}
        />
      )}
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="desk-page">
      <div className="desk-column">{children}</div>
    </div>
  );
}

/** A menu rather than a native select: choosing Off applies at once, so arrowing past it must not. */
function PeriodMenu({
  period,
  button,
  open,
  onOpen,
  onClose,
  onPick,
}: {
  period: Period;
  button: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (period: Period) => void;
}) {
  const id = useId();
  const menu = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;

    const items = () => [
      ...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitemradio]') ?? []),
    ];
    const close = (back: boolean) => {
      onClose();
      if (back) button.current?.focus();
    };
    const keys = (event: KeyboardEvent) => {
      const all = items();
      const at = all.indexOf(document.activeElement as HTMLElement);

      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      } else if (event.key === 'Tab') close(false);
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        all[(at + step + all.length) % all.length]?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!menu.current?.contains(target) && !button.current?.contains(target)) close(false);
    };

    items()
      .find((item) => item.getAttribute('aria-checked') === 'true')
      ?.focus();
    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, onClose, button]);

  return (
    <div className="desk-menu-at">
      <button
        ref={button}
        type="button"
        className="desk-filter"
        aria-label={`${W.setting}: ${period}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? onClose() : onOpen())}
      >
        {period}
        <Glyph name={open ? 'chevup' : 'chevdown'} size={16} weight={2.4} />
      </button>
      {open && (
        <ul ref={menu} id={`${id}-menu`} className="desk-menu" role="menu" aria-label={W.setting}>
          {PERIODS.map((one) => (
            <li key={one} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={one === period}
                tabIndex={-1}
                className="desk-menu-item"
                onClick={() => {
                  button.current?.focus();
                  onPick(one);
                }}
              >
                <span className="desk-menu-tick">
                  {one === period && <Glyph name="tick" size={16} weight={2.6} />}
                </span>
                <span className="today-grow">{one}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NextRun({
  run,
  zone,
  locale,
  onHold,
}: {
  run: readonly PastEvent[];
  zone: ReaderZone;
  locale: string;
  onHold: (event: PastEvent) => void;
}) {
  if (run.length === 0)
    return (
      <ul className="desk-rows">
        <li className="desk-row">
          <RowWords title={W.emptyRun} lines={[W.emptyRunLine]} />
        </li>
      </ul>
    );

  return (
    <ul className="desk-rows">
      {run.map((event) => (
        <li key={event.id} className="desk-row">
          <RowWords title={event.name} lines={[endedWords(event, zone, locale)]} />
          <button
            type="button"
            className="desk-text"
            aria-label={`${W.holdBack} ${event.name}`}
            onClick={() => onHold(event)}
          >
            {W.holdBack}
          </button>
        </li>
      ))}
    </ul>
  );
}

function HeldBack({
  held,
  zone,
  locale,
  onRelease,
}: {
  held: readonly Hold[];
  zone: ReaderZone;
  locale: string;
  onRelease: (hold: Hold) => void;
}) {
  return (
    <ul className="desk-rows">
      {held.map((hold) => (
        <li key={hold.event.id} className="desk-row data-held">
          <RowWords
            title={hold.event.name}
            lines={[heldLine(hold, zone, locale), `Reason: ${hold.reason}`]}
          />
          <button
            type="button"
            className="desk-text"
            aria-label={`${W.release} ${hold.event.name}`}
            onClick={() => onRelease(hold)}
          >
            {W.release}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The question: the count follows the period as it is picked, and nothing changes before the verb. */
function QuestionDialog({
  page,
  asking,
  question,
  refusal,
  zone,
  locale,
  onPick,
  onContact,
  onCancel,
  onConfirm,
}: {
  page: DataPage;
  asking: OnPeriod;
  question: Question;
  refusal: Refusal | null;
  zone: ReaderZone;
  locale: string;
  onPick: (period: OnPeriod) => void;
  onContact: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const none = useRef<HTMLElement>(null);
  const same = asking === page.period;

  return (
    <Dialog
      title={W.ask}
      verb={question.verb}
      red
      on={!same && refusal == null}
      first={none}
      onDismiss={onCancel}
      onConfirm={onConfirm}
    >
      <Choices
        legend={W.setting}
        hideLegend
        choices={ON_PERIODS.map((name) => ({ name, now: name === page.period }))}
        picked={asking}
        onPick={(name) => onPick(name as OnPeriod)}
      />
      {refusal != null ? (
        <div className="data-refusal" role="alert">
          <Glyph name="alert" size={20} weight={2.2} />
          <div className="desk-after">
            <p className="desk-empty-title">{REFUSALS[refusal].title}</p>
            <p className="desk-line">{REFUSALS[refusal].line}</p>
            {refusal === 'plan_required' && <TextAction label={W.contact} onClick={onContact} />}
          </div>
        </div>
      ) : same ? (
        <Note>{W.samePeriod}</Note>
      ) : (
        <div className="desk-after" aria-live="polite">
          <Note strong>{question.line}</Note>
          {question.events.length > 0 && (
            <ul className="desk-rows data-question-events">
              {question.events.map((event) => (
                <li key={event.id} className="desk-row">
                  <RowWords title={event.name} lines={[endedWords(event, zone, locale)]} />
                </li>
              ))}
            </ul>
          )}
          {question.replaces != null && <Note>{question.replaces}</Note>}
          <Note>{question.emailed}</Note>
          <Note>{W.gone}</Note>
        </div>
      )}
    </Dialog>
  );
}

/** A blank reason sends nothing: the field says so beside it and takes the focus. */
function HoldDialog({
  event,
  startsBlank,
  zone,
  locale,
  onCancel,
  onHold,
}: {
  event: PastEvent;
  startsBlank: boolean;
  zone: ReaderZone;
  locale: string;
  onCancel: () => void;
  onHold: (reason: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState('');
  const [pressed, setPressed] = useState(startsBlank);
  const [discarding, setDiscarding] = useState(false);
  const blank = isBlank(reason);

  return (
    <>
      <Dialog
        title={W.holdTitle}
        verb={W.holdBack}
        first={input}
        onDismiss={() => (blank ? onCancel() : setDiscarding(true))}
        onConfirm={() => {
          if (blank) {
            setPressed(true);
            input.current?.focus();
          } else onHold(reason);
        }}
      >
        <div className="desk-after">
          <Note strong>{event.name}</Note>
          <Note>{endedWords(event, zone, locale)}</Note>
        </div>
        <Note>{W.holdLine}</Note>
        <Field
          label={W.reason}
          value={reason}
          onChange={setReason}
          inputRef={input}
          help={W.reasonHelp}
          error={pressed && blank ? W.reasonBlank : null}
        />
      </Dialog>
      {discarding && (
        <Ask
          title={W.discard}
          line={`${event.name} stays in the next run.`}
          keep={W.keepEditing}
          go={W.discardVerb}
          onKeep={() => setDiscarding(false)}
          onGo={onCancel}
        />
      )}
    </>
  );
}

function Loading() {
  return (
    <div className="desk-loading" role="status" aria-label={W.loading}>
      <span className="desk-unseen">{W.loading}</span>
      <span className="desk-sunk is-card" aria-hidden="true" />
      <ul className="desk-rows" aria-hidden="true">
        {[1, 2].map((bar) => (
          <li key={bar} className="desk-row is-bones">
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bar}`} />
              <span className={`desk-sunk is-line b${bar}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="desk-failed" role="alert">
      <h2>{W.failed}</h2>
      <p className="desk-line">{W.failedLine}</p>
      <TextAction label={W.tryAgain} onClick={onRetry} />
    </div>
  );
}
