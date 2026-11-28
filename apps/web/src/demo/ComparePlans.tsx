import { useEffect, useId, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { Ask, Dialog } from '../components/SettingsParts.tsx';
import { type Currency, money } from './billing.ts';
import {
  COMPARE_WORDS,
  type Catalogue,
  FEATURE_ORDER,
  LIMIT_ORDER,
  type Meter,
  NEXT_MONTH,
  NEXT_YEAR,
  PLAN_ORDER,
  type PlanKey,
  type PlanTerms,
  answerTalk,
  changesFor,
  houseDate,
  includes,
  limitCell,
  priceLines,
  sentWhen,
  stepOf,
  upgradeDue,
  yearlyDue,
} from './comparePlans.ts';
import type { Lang } from './credits.ts';
import './comparePlans.css';

const PREVIEW_MS = 900;
const SEND_MS = 700;

export type TalkSay = 'thanks' | { already: number; at: number } | null;

export interface Talk {
  lastAt: number | null;
  say: TalkSay;
}

interface Shared {
  catalogue: Catalogue;
  current: PlanKey;
  meter: Meter;
  currency: Currency;
  lang: Lang;
  locale: string;
}

/** Compare plans (sc-3935), opened by Change plan: the plans side by side, then what changes for the organisation under each. */
export function ComparePlans({
  catalogue,
  current,
  meter,
  currency,
  lang,
  locale,
  talk,
  onTalk,
  onUpgrade,
  onDowngrade,
  onClose,
}: Shared & {
  talk: Talk;
  onTalk: (talk: Talk) => void;
  onUpgrade: () => void;
  onDowngrade: () => void;
  onClose: () => void;
}) {
  const w = COMPARE_WORDS[lang];
  const captionId = useId();
  const plans = PLAN_ORDER.map((key) => catalogue[key]);
  const selfServe = plans.some((plan) => plan.key !== 'free' && plan.sales === 'self_serve');

  return (
    <Dialog title={w.title} verb={null} dismiss={w.close} onDismiss={onClose} onConfirm={onClose}>
      <div className="cp">
        {selfServe && <p className="cp-test">{w.testCatalogue}</p>}
        <div className="cp-table-wrap">
          <table className="cp-table" aria-describedby={captionId}>
            <caption className="cp-hidden">{w.caption}</caption>
            <thead>
              <tr>
                <td className="cp-corner" />
                {plans.map((plan) => (
                  <PlanHead
                    key={plan.key}
                    plan={plan}
                    current={current}
                    currency={currency}
                    lang={lang}
                    locale={locale}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {LIMIT_ORDER.map((key) => (
                <tr key={key}>
                  <th scope="row">{w.limits[key]}</th>
                  {plans.map((plan) => (
                    <td key={plan.key} className="cp-amount">
                      {limitCell(plan, key, locale, lang)}
                    </td>
                  ))}
                </tr>
              ))}
              {FEATURE_ORDER.map((feature) => (
                <tr key={feature}>
                  <th scope="row">{w.features[feature]}</th>
                  {plans.map((plan) => (
                    <td key={plan.key}>
                      {includes(plan, feature) ? (
                        <span className="cp-mark is-in">
                          <Glyph name="tick" size={16} weight={2.6} className="cp-tick" />
                          {w.included}
                        </span>
                      ) : (
                        <span className="cp-mark is-out">
                          <span className="cp-empty" aria-hidden="true" />
                          {w.notIncluded}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p id={captionId} className="cp-tax">
          {w.tax}
        </p>

        <h3 className="cp-changes-title">{w.changes}</h3>
        <div className="cp-boxes">
          {plans.map((plan) => (
            <PlanBox
              key={plan.key}
              plan={plan}
              catalogue={catalogue}
              current={current}
              meter={meter}
              currency={currency}
              lang={lang}
              locale={locale}
              talk={talk}
              onTalk={onTalk}
              onUpgrade={onUpgrade}
              onDowngrade={onDowngrade}
            />
          ))}
        </div>
      </div>
    </Dialog>
  );
}

function PlanHead({
  plan,
  current,
  currency,
  lang,
  locale,
}: {
  plan: PlanTerms;
  current: PlanKey;
  currency: Currency;
  lang: Lang;
  locale: string;
}) {
  const w = COMPARE_WORDS[lang];
  const price = priceLines(plan, currency, locale, lang);

  return (
    <th scope="col" className={plan.key === current ? 'cp-head is-current' : 'cp-head'}>
      <span className="cp-head-name">{w.names[plan.key]}</span>
      {plan.key === current && <span className="cp-now">{w.yourPlan}</span>}
      <span className="cp-head-price">{price.main}</span>
      {price.under != null && <span className="cp-head-under">{price.under}</span>}
    </th>
  );
}

function PlanBox({
  plan,
  catalogue,
  current,
  meter,
  lang,
  locale,
  talk,
  onTalk,
  onUpgrade,
  onDowngrade,
}: Shared & {
  plan: PlanTerms;
  talk: Talk;
  onTalk: (talk: Talk) => void;
  onUpgrade: () => void;
  onDowngrade: () => void;
}) {
  const w = COMPARE_WORDS[lang];
  const step = stepOf(plan, current);
  const lines = changesFor(plan, catalogue[current], meter, locale, lang);

  return (
    <section
      className={step === 'current' ? 'cp-box is-current' : 'cp-box'}
      aria-label={`${w.names[plan.key]}: ${w.changes}`}
    >
      <p className="cp-box-name">
        {w.names[plan.key]}
        {step === 'current' && <span className="cp-now">{w.yourPlan}</span>}
      </p>
      <ul className="cp-lines">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {step === 'talk' && <TalkStep lang={lang} locale={locale} talk={talk} onTalk={onTalk} />}
      {step === 'upgrade' && (
        <button type="button" className="button button-primary cp-go" onClick={onUpgrade}>
          {w.upgrade}
        </button>
      )}
      {step === 'downgrade' && (
        <button type="button" className="button cp-go" onClick={onDowngrade}>
          {w.downgrade}
        </button>
      )}
    </section>
  );
}

function TalkStep({
  lang,
  locale,
  talk,
  onTalk,
}: {
  lang: Lang;
  locale: string;
  talk: Talk;
  onTalk: (talk: Talk) => void;
}) {
  const w = COMPARE_WORDS[lang];
  const [sending, setSending] = useState(false);
  const said = useRef<HTMLParagraphElement>(null);
  const { say } = talk;

  useEffect(() => {
    if (!sending) return;
    const timer = setTimeout(() => {
      const at = Date.now();
      const answer = answerTalk(talk.lastAt, at);
      setSending(false);
      onTalk(
        'sent' in answer
          ? { lastAt: answer.sent, say: 'thanks' }
          : { lastAt: talk.lastAt, say: { already: answer.already, at } },
      );
    }, SEND_MS);

    return () => clearTimeout(timer);
  }, [sending, talk.lastAt, onTalk]);

  useEffect(() => {
    if (say != null) said.current?.focus();
  }, [say]);

  if (say === 'thanks') {
    return (
      <div className="cp-said-region" role="status">
        <p ref={said} className="cp-said" tabIndex={-1}>
          <Glyph name="tick" size={18} weight={2.4} className="cp-said-icon" />
          {w.thanks}
        </p>
      </div>
    );
  }

  if (say != null) {
    return (
      <div className="cp-said-region" role="status">
        <p ref={said} className="cp-said" tabIndex={-1}>
          <Glyph name="clock" size={18} weight={2.2} className="cp-said-icon" />
          {w.already(sentWhen(say.already, say.at, locale, lang))}
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="cp-talk-line">{w.talkLine}</p>
      <button
        type="button"
        className={sending ? 'button button-primary cp-go is-busy' : 'button button-primary cp-go'}
        aria-busy={sending || undefined}
        aria-disabled={sending || undefined}
        onClick={() => {
          if (!sending) setSending(true);
        }}
      >
        {sending && <span className="pending-spinner" aria-hidden="true" />}
        {sending ? w.talkSending : w.talk}
      </button>
    </>
  );
}

export type PlanAskKind = 'upgrade' | 'downgrade' | 'cancel' | 'yearly';

/** The one question each plan change asks: Upgrade with the provider's amount for today, Switch to yearly, and Downgrade or Cancel plan at the period's end. */
export function PlanAsk({
  kind,
  catalogue,
  current,
  meter,
  currency,
  lang,
  locale,
  ends,
  previewed,
  declined,
  onKeep,
  onGo,
  onUpdate,
}: Shared & {
  kind: PlanAskKind;
  /** The day the period ends: when a downgrade takes effect, and what a switch to yearly credits back. */
  ends: string;
  previewed: boolean;
  /** The provider refused the yearly charge on the saved payment method (pm, 28 Nov). */
  declined: boolean;
  onKeep: () => void;
  onGo: () => void;
  onUpdate: () => void;
}) {
  const w = COMPARE_WORDS[lang];
  const [ready, setReady] = useState(previewed || kind === 'downgrade' || kind === 'cancel');
  const listId = useId();

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setReady(true), PREVIEW_MS);

    return () => clearTimeout(timer);
  }, [ready]);

  const now = w.names[current];
  const free = w.names.free;
  const enterprise = catalogue.enterprise;
  const end = houseDate(ends, locale);

  if (kind === 'upgrade') {
    return (
      <Ask
        title={w.askUpgrade(w.names.enterprise)}
        line={ready ? undefined : w.previewing}
        keep={w.notNow}
        go={w.toPayment}
        red={false}
        off={!ready}
        describedBy={listId}
        onKeep={onKeep}
        onGo={() => {
          if (ready) onGo();
        }}
      >
        <div id={listId} className="cp-ask">
          {ready && (
            <>
              <p className="cp-due">
                <span>{w.dueToday}</span>
                <span className="cp-due-amount">
                  {money(upgradeDue(enterprise, currency), currency, locale)}
                </span>
              </p>
              <p>{w.newPeriod(houseDate(NEXT_MONTH, locale))}</p>
              <p>{w.appliesOnPayment}</p>
            </>
          )}
          <ChangeList
            lines={changesFor(enterprise, catalogue[current], meter, locale, lang)}
            lang={lang}
          />
        </div>
      </Ask>
    );
  }

  if (kind === 'yearly' && declined) {
    return (
      <Ask
        title={w.askYearly}
        line={w.yearlyRefused(now)}
        told
        keep={w.keepMonthly}
        go={w.updateMethod}
        red={false}
        onKeep={onKeep}
        onGo={onUpdate}
      />
    );
  }

  if (kind === 'yearly') {
    return (
      <Ask
        title={w.askYearly}
        line={
          ready
            ? w.yearlyLine(
                money(enterprise.prices[currency].year, currency, locale),
                money(yearlyDue(enterprise, currency, ends), currency, locale),
                houseDate(NEXT_YEAR, locale),
              )
            : w.previewing
        }
        keep={w.keepMonthly}
        go={w.switchYearly}
        red={false}
        off={!ready}
        onKeep={onKeep}
        onGo={() => {
          if (ready) onGo();
        }}
      />
    );
  }

  return (
    <Ask
      title={kind === 'cancel' ? w.askCancel(now) : w.askDowngrade(free)}
      line={w.askLine(now, free, end)}
      keep={w.keep(now)}
      go={kind === 'cancel' ? w.goCancel : w.goDowngrade}
      red={false}
      describedBy={listId}
      onKeep={onKeep}
      onGo={onGo}
    >
      <div id={listId} className="cp-ask">
        <ChangeList
          lines={changesFor(catalogue.free, catalogue[current], meter, locale, lang)}
          lang={lang}
        />
      </div>
    </Ask>
  );
}

function ChangeList({ lines, lang }: { lines: readonly string[]; lang: Lang }) {
  return (
    <>
      <p className="cp-ask-title">{COMPARE_WORDS[lang].changes}</p>
      <ul className="cp-lines">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </>
  );
}
