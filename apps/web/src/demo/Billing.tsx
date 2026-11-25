import { formattingLocale } from '@soirely/domain';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Dialog, Head, type Tell, TitleRow } from '../components/SettingsParts.tsx';
import {
  BILLING_WORDS as W,
  type BillingState,
  type Currency,
  ENTERPRISE,
  type Entry,
  type Method,
  PACKS,
  type Pack,
  SAMPLE_BALANCE,
  SAMPLE_LEDGER,
  UPDATED_CARD,
  WAIT_MS,
  billingStateOf,
  boughtSaid,
  buyingLine,
  count,
  creditsWord,
  currencyOf,
  ledgerDay,
  methodFor,
  methodLine,
  methodShape,
  money,
  renewsLine,
  signed,
  slowIn,
  waitLook,
  withBought,
} from './billing.ts';
import { DemoBell } from './DemoBell.tsx';
import { OfflineBox } from './DemoOffline.tsx';
import { EventsShell } from './EventParts.tsx';
import { SIDEBAR_EVENTS, viewerOf } from './settings.ts';
import { TodaySidebar } from './TodaySidebar.tsx';
import './billing.css';

const REFRESH_MS = 900;

interface Wait {
  id: number;
  credits: number;
  paidAt: number;
}

type Hosted = { kind: 'pack'; pack: Pack } | { kind: 'plan' } | { kind: 'update' };

type Plan = 'free' | 'confirming' | 'enterprise';

interface Start {
  balance: number;
  ledger: readonly Entry[];
  packsOpen: boolean;
  hosted: Hosted | null;
  waits: readonly Wait[];
  notAdded: boolean;
  plan: Plan;
  planPaidAt: number | null;
  method: Method;
  refused: boolean;
  offline: boolean;
}

const FIRST: Pack = PACKS[0] as Pack;

/** What only the tab that opened a checkout shows, which a role that cannot open one never has. */
function startFor(state: BillingState, manages: boolean, now: number): Start {
  const start = startOf(state, now);
  if (manages) return start;

  return {
    ...start,
    packsOpen: false,
    hosted: null,
    waits: [],
    notAdded: false,
    plan: start.plan === 'confirming' ? 'free' : start.plan,
    planPaidAt: null,
  };
}

function startOf(state: BillingState, now: number): Start {
  const waiting = (ago: number, id = 1, credits = FIRST.credits): Wait => ({
    id,
    credits,
    paidAt: now - ago,
  });
  const base: Start = {
    balance: SAMPLE_BALANCE,
    ledger: SAMPLE_LEDGER.slice(0, 10),
    packsOpen: false,
    hosted: null,
    waits: [],
    notAdded: false,
    plan: 'free',
    planPaidAt: null,
    method: methodFor(state),
    refused: false,
    offline: false,
  };

  switch (state) {
    case 'packs':
      return { ...base, packsOpen: true };
    case 'checkout_open':
      return { ...base, packsOpen: true, hosted: { kind: 'pack', pack: FIRST } };
    case 'buying':
      return { ...base, waits: [waiting(4000)] };
    case 'buying_two':
      return { ...base, waits: [waiting(40_000), waiting(6000, 2, 5000)] };
    case 'buying_reload':
      return { ...base, waits: [waiting(90_000)] };
    case 'bought':
      return {
        ...base,
        balance: SAMPLE_BALANCE + FIRST.credits,
        ledger: withBought(base.ledger, boughtEntry(0, FIRST.credits)),
      };
    case 'slow':
      return { ...base, waits: [waiting(WAIT_MS)] };
    case 'slow_one':
      return { ...base, waits: [waiting(WAIT_MS + 5000), waiting(30_000, 2, 5000)] };
    case 'not_added':
      return { ...base, packsOpen: true, notAdded: true };
    case 'confirming_plan':
      return { ...base, plan: 'confirming', planPaidAt: now - 4000 };
    case 'plan_slow':
      return { ...base, plan: 'confirming', planPaidAt: now - WAIT_MS };
    case 'plan_confirmed':
      return { ...base, plan: 'enterprise' };
    case 'update_open':
      return { ...base, hosted: { kind: 'update' } };
    case 'refused':
      return { ...base, refused: true };
    case 'offline_wait':
      return { ...base, waits: [waiting(20_000)], offline: true };
    default:
      return base;
  }
}

function boughtEntry(id: number, credits: number): Entry {
  return { id: `bought-${id}`, day: '2026-11-24', words: W.bought, credits };
}

/** Settings › Plan and billing (Billing.dc.html, page 37), Tweak checkout (sc-3933), on sample data. */
export function Billing() {
  const [params] = useSearchParams();
  const raw = params.get('state');
  const as = params.get('as');
  const currency = currencyOf(params.get('currency'));

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <TodaySidebar events={SIDEBAR_EVENTS} tell={tell} settings inert={covered} />
      )}
    >
      {(tell) => (
        <BillingPage
          key={`${raw ?? ''}:${as ?? ''}:${currency}`}
          state={billingStateOf(raw)}
          manages={viewerOf(as).owns}
          currency={currency}
          tell={tell}
        />
      )}
    </EventsShell>
  );
}

function BillingPage({
  state,
  manages,
  currency,
  tell,
}: {
  state: BillingState;
  manages: boolean;
  currency: Currency;
  tell: Tell;
}) {
  const locale = useMemo(() => formattingLocale('en', navigator.language), []);
  const [start] = useState(() => startFor(state, manages, Date.now()));
  const [balance, setBalance] = useState(start.balance);
  const [ledger, setLedger] = useState(start.ledger);
  const [packsOpen, setPacksOpen] = useState(start.packsOpen);
  const [hosted, setHosted] = useState(start.hosted);
  const [waits, setWaits] = useState(start.waits);
  const [notAdded, setNotAdded] = useState(start.notAdded);
  const [plan, setPlan] = useState(start.plan);
  const [planPaidAt, setPlanPaidAt] = useState(start.planPaidAt);
  const [method, setMethod] = useState(start.method);
  const [refused] = useState(start.refused);
  const [offline, setOffline] = useState(start.offline);
  const [refreshing, setRefreshing] = useState(false);
  const [said, setSaid] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [dropped, setDropped] = useState<string | null>(null);
  const nextId = useRef(3);
  const live = useRef({ waits, balance });
  const addCredits = useRef<HTMLButtonElement>(null);
  const packButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const update = useRef<HTMLButtonElement>(null);
  const changePlan = useRef<HTMLButtonElement>(null);
  const pressed = useRef(0);
  const packsId = useId();
  const can = manages && !refused;
  const planWaiting = plan === 'confirming' && planPaidAt != null;

  useEffect(() => {
    const times = [
      ...waits.map((wait) => slowIn(wait.paidAt, Date.now())),
      ...(planWaiting && planPaidAt != null ? [slowIn(planPaidAt, Date.now())] : []),
    ].filter((ms) => ms > 0);
    if (times.length === 0) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(...times) + 50);

    return () => clearTimeout(timer);
  }, [waits, planWaiting, planPaidAt, now]);

  useEffect(() => {
    live.current = { waits, balance };
  });

  useEffect(() => {
    if (!refreshing) return;
    const timer = setTimeout(() => setRefreshing(false), REFRESH_MS);

    return () => clearTimeout(timer);
  }, [refreshing]);

  const focusLater = (target: () => HTMLElement | null | undefined) =>
    requestAnimationFrame(() => target()?.focus());

  const land = (landing: readonly Wait[]) => {
    const last = landing.at(-1);
    if (last == null) return;
    const ids = new Set(landing.map((wait) => wait.id));
    const credits = landing.reduce((sum, wait) => sum + wait.credits, 0);
    const next = live.current.balance + credits;
    live.current = { waits: live.current.waits.filter((one) => !ids.has(one.id)), balance: next };
    setWaits((all) => all.filter((one) => !ids.has(one.id)));
    setBalance(next);
    setLedger((all) =>
      landing.reduce((rows, wait) => withBought(rows, boughtEntry(wait.id, wait.credits)), all),
    );
    setDropped(`bought-${last.id}`);
    setSaid(boughtSaid(credits, next, locale));
  };

  const pay = (pack: Pack) => {
    const id = nextId.current++;
    setHosted(null);
    setPacksOpen(false);
    setNotAdded(false);
    setWaits((all) => [...all, { id, credits: pack.credits, paidAt: Date.now() }]);
    setSaid(buyingLine(pack.credits, locale));
    focusLater(() => addCredits.current);
  };

  const notPaid = () => {
    setHosted(null);
    setNotAdded(true);
    setPacksOpen(true);
    setSaid(W.notAdded);
    focusLater(() => packButtons.current[pressed.current]);
  };

  const closeHosted = () => {
    const was = hosted;
    setHosted(null);
    if (was?.kind === 'pack') notPaid();
    else if (was?.kind === 'update') focusLater(() => update.current);
    else focusLater(() => changePlan.current);
  };

  const planPaid = () => {
    setHosted(null);
    setPlan('confirming');
    setPlanPaidAt(Date.now());
    setSaid(W.confirming);
  };

  const planLands = () => {
    setPlan('enterprise');
    setPlanPaidAt(null);
    setRefreshing(true);
    setSaid(`${W.yourPlan}: ${W.enterprise}. ${renewsLine(locale)}.`);
  };

  const cardSaved = () => {
    setHosted(null);
    setRefreshing(true);
    focusLater(() => update.current);
    setTimeout(() => {
      setMethod(UPDATED_CARD);
      setSaid(`${W.paymentMethod}: ${methodLine(UPDATED_CARD) ?? ''}.`);
    }, REFRESH_MS);
  };

  const backOnline = () => {
    setOffline(false);
    setRefreshing(true);
    setTimeout(() => {
      const at = Date.now();
      land(live.current.waits.filter((wait) => waitLook(wait.paidAt, at) === 'waiting'));
    }, REFRESH_MS);
  };

  const twoMinutes = () => {
    setWaits((all) => all.map((wait) => ({ ...wait, paidAt: wait.paidAt - WAIT_MS })));
    setPlanPaidAt((at) => (at == null ? at : at - WAIT_MS));
    setNow(Date.now());
  };

  const time = now;

  return (
    <div className="desk-page">
      <div className="desk-column bl">
        {offline && <OfflineBox time="14:00" onRetry={backOnline} />}
        <TitleRow
          title={W.title}
          action={
            refreshing ? (
              <span className="bl-refreshing" role="status">
                <span className="pending-spinner" aria-hidden="true" />
                {W.refreshing}
              </span>
            ) : undefined
          }
          bell={<DemoBell tell={tell} />}
        />
        <p className="bl-said" role="status" aria-live="polite">
          {said}
        </p>

        <section className="desk-block bl-card" aria-labelledby="bl-plan">
          <Head title={<span id="bl-plan">{W.yourPlan}</span>}>
            {can && plan === 'free' && (
              <button
                ref={changePlan}
                type="button"
                className="desk-text"
                onClick={() => setHosted({ kind: 'plan' })}
              >
                {W.changePlan}
              </button>
            )}
          </Head>
          <p className="bl-plan-name">{plan === 'enterprise' ? W.enterprise : W.free}</p>
          {plan === 'enterprise' && <p className="desk-line">{renewsLine(locale)}</p>}
          {planWaiting && planPaidAt != null && (
            <WaitInset
              look={waitLook(planPaidAt, time)}
              words={W.confirming}
              onLand={offline ? undefined : planLands}
              landLabel="Webhook: the plan is paid"
            />
          )}
          {plan !== 'free' && <p className="bl-caption">{W.sandbox}</p>}
        </section>

        <section className="desk-block bl-card" aria-labelledby="bl-credits">
          <Head title={<span id="bl-credits">{W.credits}</span>} />
          <p className="bl-balance" aria-busy={waits.length > 0 || undefined}>
            {creditsWord(balance, locale)}
          </p>
          <p className="desk-line">{W.included}</p>
          {refused && (
            <div className="bl-inset is-refused" role="alert">
              <Glyph name="alert" size={18} weight={2.2} />
              <p>{W.refused}</p>
            </div>
          )}
          {waits.map((wait) => (
            <WaitInset
              key={wait.id}
              look={waitLook(wait.paidAt, time)}
              words={buyingLine(wait.credits, locale)}
              onLand={offline ? undefined : () => land([wait])}
              landLabel={`Webhook: ${count(wait.credits, locale)} credits paid`}
            />
          ))}
          {can && (
            <>
              <button
                ref={addCredits}
                type="button"
                className="desk-text bl-disclosure"
                aria-expanded={packsOpen}
                aria-controls={packsId}
                onClick={() => setPacksOpen((open) => !open)}
              >
                {W.addCredits}
                <Glyph
                  name="chevdown"
                  size={16}
                  weight={2.4}
                  className={packsOpen ? 'bl-chevron is-open' : 'bl-chevron'}
                />
              </button>
              <div id={packsId} className="bl-packs" hidden={!packsOpen}>
                {notAdded && (
                  <div className="bl-inset" role="status">
                    <span className="bl-ring" aria-hidden="true">
                      –
                    </span>
                    <p>{W.notAdded}</p>
                  </div>
                )}
                <ul className="bl-pills">
                  {PACKS.map((pack, index) => (
                    <li key={pack.credits}>
                      <button
                        ref={(node) => {
                          packButtons.current[index] = node;
                        }}
                        type="button"
                        className="bl-pill"
                        onClick={() => {
                          pressed.current = index;
                          setHosted({ kind: 'pack', pack });
                        }}
                      >
                        <span className="bl-pill-credits">{creditsWord(pack.credits, locale)}</span>
                        <span>{money(pack.price[currency], currency, locale)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="bl-note">{W.packsNote}</p>
              </div>
            </>
          )}
          <h3 className="bl-sub">{W.recent}</h3>
          <ul className="desk-rows bl-ledger">
            {ledger.map((entry) => (
              <li key={entry.id} className={entry.id === dropped ? 'bl-entry is-new' : 'bl-entry'}>
                <span className="bl-entry-day">{ledgerDay(entry.day, locale)}</span>
                <span className="bl-entry-words">{entry.words}</span>
                <span className="bl-entry-amount">{signed(entry.credits, locale)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="desk-block bl-card" aria-labelledby="bl-method">
          <Head title={<span id="bl-method">{W.paymentMethod}</span>}>
            {can && (
              <button
                ref={update}
                type="button"
                className="desk-text"
                aria-label={W.updateName}
                onClick={() => setHosted({ kind: 'update' })}
              >
                {W.update}
              </button>
            )}
          </Head>
          <MethodLine method={method} />
          <p className="desk-line">{W.cardNote}</p>
        </section>

        {(waits.length > 0 || planWaiting) && (
          <div className="bl-demo-only">
            <p>Stand-in for time passing, in the demo only.</p>
            <button type="button" className="desk-text" onClick={twoMinutes}>
              Two minutes pass
            </button>
          </div>
        )}
      </div>

      {hosted != null && (
        <Dialog
          title={hosted.kind === 'update' ? W.pageTitle : W.checkoutTitle}
          verb={null}
          dismiss={W.close}
          onDismiss={closeHosted}
          onConfirm={closeHosted}
        >
          <HostedStandIn
            hosted={hosted}
            currency={currency}
            locale={locale}
            onPay={() => (hosted.kind === 'pack' ? pay(hosted.pack) : planPaid())}
            onFail={notPaid}
            onSave={cardSaved}
          />
        </Dialog>
      )}
    </div>
  );
}

function WaitInset({
  look,
  words,
  onLand,
  landLabel,
}: {
  look: 'waiting' | 'slow';
  words: string;
  onLand: (() => void) | undefined;
  landLabel: string;
}) {
  return (
    <div className="bl-inset bl-drop">
      {look === 'waiting' ? (
        <span className="pending-spinner" aria-hidden="true" />
      ) : (
        <Glyph name="clock" size={18} weight={2.2} />
      )}
      <div className="bl-inset-words">
        {look === 'waiting' ? (
          <p>{words}</p>
        ) : (
          <>
            <p>{W.slow}</p>
            <p className="bl-inset-under">{W.slowEmail}</p>
          </>
        )}
      </div>
      {onLand != null && (
        <button type="button" className="bl-stand-in" onClick={onLand}>
          {landLabel}
        </button>
      )}
    </div>
  );
}

function MethodLine({ method }: { method: Method }) {
  const line = methodLine(method);
  const shape = methodShape(method);
  if (line == null || shape == null) return null;

  return (
    <p className="bl-method">
      <span className={`bl-method-shape is-${shape.kind}`} aria-hidden="true">
        {shape.kind === 'brand' ? (
          shape.mark
        ) : (
          <Glyph name={shape.kind === 'wallet' ? 'wallet' : 'cards'} size={18} weight={2} />
        )}
      </span>
      {line}
    </p>
  );
}

function HostedStandIn({
  hosted,
  currency,
  locale,
  onPay,
  onFail,
  onSave,
}: {
  hosted: Hosted;
  currency: Currency;
  locale: string;
  onPay: () => void;
  onFail: () => void;
  onSave: () => void;
}) {
  const passed: ReactNode[] =
    hosted.kind === 'update'
      ? ['The customer: Ire Events’ billing account', 'The subscription']
      : hosted.kind === 'plan'
        ? [
            `The catalogue item: ${W.enterprise}, ${money(ENTERPRISE.price, ENTERPRISE.currency, locale)} a month`,
            `The currency: ${ENTERPRISE.currency}`,
            'The customer: Ire Events’ billing account',
            'The organisation: Ire Events',
          ]
        : [
            `The catalogue item: ${creditsWord(hosted.pack.credits, locale)}, ${money(hosted.pack.price[currency], currency, locale)}`,
            `The currency: ${currency}`,
            'The customer: Ire Events’ billing account',
            'The organisation: Ire Events',
          ];

  return (
    <div className="bl-hosted">
      <p className="desk-line">{W.standInLine}</p>
      <ul className="bl-hosted-list">
        {passed.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
      <div className="bl-demo-only">
        <p>Stand-ins for what happens inside Paddle’s page, in the demo only.</p>
        {hosted.kind === 'update' ? (
          <button type="button" className="desk-text" onClick={onSave}>
            Save a new card
          </button>
        ) : (
          <>
            <button type="button" className="desk-text" onClick={onPay}>
              Pay
            </button>
            {hosted.kind === 'pack' && (
              <button type="button" className="desk-text" onClick={onFail}>
                The payment fails
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
