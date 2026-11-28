import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Head, type Tell, TitleRow } from '../components/SettingsParts.tsx';
import {
  CONTRACT_WORDS as W,
  type Contract,
  type ContractState,
  type Invoice,
  TERMS_NAMES,
  addDays,
  bannerWords,
  contractStart,
  contractStateOf,
  endsIn,
  owedMoney,
  priceLine,
  shortDate,
  standingOf,
  statusOf,
} from './contract.ts';
import { EventsShell } from './EventParts.tsx';
import { SIDEBAR_EVENTS, viewerOf } from './settings.ts';
import { TodaySidebar } from './TodaySidebar.tsx';
import './billing.css';
import './contract.css';

/** sc-613: Settings › Plan and billing for an organisation on an Enterprise contract, with the overdue banner, on sample data. */
export function ContractBilling() {
  const [params] = useSearchParams();
  const raw = params.get('state');
  const viewer = viewerOf(params.get('as'));
  const locale = params.get('locale') === 'en-US' ? 'en-US' : 'en-GB';
  const onEvents = params.get('page') === 'events' || !viewer.owns;

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <TodaySidebar events={SIDEBAR_EVENTS} tell={tell} settings={!onEvents} inert={covered} />
      )}
    >
      {(tell) => (
        <ContractPage
          key={`${raw ?? ''}:${viewer.key}:${locale}:${String(onEvents)}`}
          state={contractStateOf(raw)}
          billingRead={viewer.owns}
          onEvents={onEvents}
          locale={locale}
          tell={tell}
        />
      )}
    </EventsShell>
  );
}

function ContractPage({
  state,
  billingRead,
  onEvents,
  locale,
  tell,
}: {
  state: ContractState;
  billingRead: boolean;
  onEvents: boolean;
  locale: string;
  tell: Tell;
}) {
  const start = contractStart(state);
  const { contract } = start;
  const [today, setToday] = useState(start.today);
  const [invoices, setInvoices] = useState(start.invoices);
  const [said, setSaid] = useState('');
  const standing = standingOf(invoices, today);
  const banner = billingRead ? bannerWords(standing, contract, locale) : null;
  const ending = endsIn(contract, today);

  const paid = () => {
    if (standing.kind === 'fine') return;
    const settled = standing.invoice.id;
    setInvoices((all) =>
      all.map((invoice) =>
        invoice.id === settled ? { ...invoice, owed: 0, status: 'paid' as const } : invoice,
      ),
    );
    setSaid('The invoice is paid. Everything is back.');
  };

  return (
    <div className="desk-page">
      <div className="desk-column bl">
        {banner != null && (
          <div
            className={standing.kind === 'read_only' ? 'ct-banner is-locked' : 'ct-banner'}
            role="note"
          >
            <span className="ct-banner-mark" aria-hidden="true">
              {standing.kind === 'read_only' ? <Glyph name="lock" size={15} weight={2.4} /> : '!'}
            </span>
            <p>{banner}</p>
          </div>
        )}
        <TitleRow title={onEvents ? 'Events' : W.title} />
        <p className="bl-said" role="status" aria-live="polite">
          {said}
        </p>

        {onEvents ? (
          <p className="desk-line">The Events page, as on main.</p>
        ) : (
          <>
            <PlanCard contract={contract} ending={ending} locale={locale} tell={tell} />
            <InvoicesCard
              invoices={invoices}
              today={today}
              contract={contract}
              locale={locale}
              tell={tell}
            />
          </>
        )}

        <div className="bl-demo-only">
          <p>
            Stand-ins, in the demo only. Today is {shortDate(today, locale)} in the organisation’s
            time zone.{' '}
            {billingRead
              ? 'The banner shows to people with billing.read, on every web page.'
              : 'Ana is a Member, without billing.read, so no banner shows.'}
          </p>
          {standing.kind !== 'fine' && (
            <button type="button" className="desk-text" onClick={paid}>
              Webhook: Paddle reports it paid
            </button>
          )}
          {standing.kind === 'overdue' && (
            <>
              <button
                type="button"
                className="desk-text"
                onClick={() => setToday((day) => addDays(day, 1))}
              >
                A day passes
              </button>
              <button
                type="button"
                className="desk-text"
                onClick={() => setToday(addDays(standing.lastDay, 1))}
              >
                Day 31 begins: read-only
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  contract,
  ending,
  locale,
  tell,
}: {
  contract: Contract;
  ending: number | null;
  locale: string;
  tell: Tell;
}) {
  const rows: [string, string][] = [
    [W.term, `${shortDate(contract.start, locale)} to ${shortDate(contract.end, locale)}`],
    [W.price, priceLine(contract, locale)],
    [W.paymentTerms, TERMS_NAMES[contract.terms]],
    ...(contract.purchaseOrder == null
      ? []
      : [[W.purchaseOrder, contract.purchaseOrder] as [string, string]]),
    [W.contacts, contract.contacts.join(', ')],
  ];

  return (
    <section className="desk-block bl-card" aria-labelledby="ct-plan">
      <Head title={<span id="ct-plan">{W.yourPlan}</span>} />
      <p className="bl-plan-name">
        {W.enterprise} <span className="ct-on">· {W.onContract}</span>
      </p>
      {ending != null && (
        <div className="bl-inset ct-ending" role="note">
          <Glyph name="clock" size={18} weight={2.2} />
          <div className="bl-inset-words">
            <p className="ct-strong">{W.endsTitle}</p>
            <p className="bl-inset-under">
              {W.endsLine
                .replace('{{date}}', shortDate(contract.end, locale))
                .replace('{{organisation}}', contract.organisation)}
            </p>
          </div>
        </div>
      )}
      <dl className="ct-facts">
        {rows.map(([term, value]) => (
          <div key={term} className="ct-fact">
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="desk-line">{W.talkLine}</p>
      <button
        type="button"
        className="desk-text ct-talk"
        onClick={() => tell('Talk to us opens sc-3935’s contact form, as on main.')}
      >
        {W.talk}
      </button>
    </section>
  );
}

function InvoicesCard({
  invoices,
  today,
  contract,
  locale,
  tell,
}: {
  invoices: readonly Invoice[];
  today: string;
  contract: Contract;
  locale: string;
  tell: Tell;
}) {
  return (
    <section className="desk-block bl-card" aria-labelledby="ct-invoices">
      <Head title={<span id="ct-invoices">{W.invoices}</span>} />
      <p className="desk-line">{W.invoicesLine}</p>
      <ul className="ct-invoices">
        {invoices.map((invoice) => {
          const status = statusOf(invoice, today);
          const label = `${W.download} the invoice of ${shortDate(invoice.issued, locale)}`;

          return (
            <li key={invoice.id} className="ct-invoice">
              <span className="ct-issued">{shortDate(invoice.issued, locale)}</span>
              <span className="ct-amount">
                {owedMoney(invoice.total, contract.currency, locale)}
              </span>
              <span className={`ct-status is-${status.shape}`}>
                {status.shape === 'tick' ? (
                  <Glyph name="tick" size={14} weight={3} />
                ) : status.shape === 'ring' ? (
                  <span className="ct-ring" aria-hidden="true" />
                ) : (
                  <span className="ct-bang" aria-hidden="true">
                    !
                  </span>
                )}
                {status.word}
              </span>
              <button
                type="button"
                className="desk-text"
                aria-label={label}
                onClick={() => tell(`Paddle’s PDF for ${invoice.number} opens in a new tab.`)}
              >
                {W.download}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
