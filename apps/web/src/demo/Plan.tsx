import { type ReactNode, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { CardStep, OnCard, Says, TextAction } from '../components/SettingsParts.tsx';
import {
  Amount,
  Block,
  BudgetCard,
  BudgetLoading,
  BudgetRow,
  BudgetShell,
  CardPairs,
  Columns,
  DashedMark,
  GlassTags,
  InfoLine,
  MarkWord,
  NotLiveStrip,
  OpenMark,
  PageTitle,
  Rows,
} from './BudgetParts.tsx';
import { budgetAt } from './budgetSample.ts';
import { BUDGET_WORDS } from './budgetWords.ts';
import { type SampleEvent } from './events.ts';
import { money } from './budget.ts';
import {
  type AcrossCost,
  type AcrossRow,
  type Fact,
  type PlanRow,
  type PlanSample,
  type PlanShown,
  acrossRows,
  afterPairs,
  kindOf,
  planPairs,
  planRows,
  printedLine,
  sampleOf,
  sheetFigures,
  shownOf,
} from './plan.ts';
import { PLAN_WORDS as W } from './planWords.ts';
import { usePrint } from './usePrint.ts';
import './plan.css';

const BUSY_MS = 900;

/** The vendors with a page in the demo's Quotes; a quote from any other is named, not linked. */
const QUOTED = new Set(['v3', 'v4', 'v5', 'v6']);

/** Against plan (sc-89): the card's four figures, By category with each quote, the quotes in no one category, and Print. */
export function PlanPage({ event, state }: { event: SampleEvent; state: string }) {
  if (state === 'print') {
    const sample = sampleOf('plan');

    return (
      <main className="desk bud plan-paper">
        <PrintSheet event={event} sample={sample} />
      </main>
    );
  }

  return (
    <BudgetShell
      event={event}
      trail={[{ label: BUDGET_WORDS.budget, to: budgetAt() }, { label: W.title }]}
    >
      {() => <PlanBody event={event} state={state} />}
    </BudgetShell>
  );
}

/** What stands in for a page's figures while it loads, fails or has no costs, the Budget home's way. */
export function PlanAround({
  title,
  first,
  words,
  event,
  emptyLine,
  actions,
  children,
}: {
  title: string;
  first: PlanShown;
  words: { loading: string; failed: string };
  event: SampleEvent;
  emptyLine: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [shown, setShown] = useState(first);

  if (shown === 'loading')
    return (
      <>
        <PageTitle title={title} />
        <BudgetLoading words={words.loading} />
      </>
    );

  if (shown === 'failed')
    return (
      <>
        <PageTitle title={title} />
        <p className="desk-line is-ink">{words.failed}</p>
        <TextAction
          label={W.tryAgain}
          onClick={() => {
            setShown('loading');
            window.setTimeout(() => setShown('figures'), BUSY_MS);
          }}
        />
      </>
    );

  if (shown === 'empty')
    return (
      <>
        <PageTitle title={title} />
        <BudgetCard event={event} label={title}>
          <Says>{W.empty}</Says>
          <OnCard>{emptyLine}</OnCard>
          <div className="bud-card-foot">
            <CardStep label={W.openBudget} onClick={() => void navigate(budgetAt('first_time'))} />
          </div>
        </BudgetCard>
      </>
    );

  return (
    <>
      <PageTitle title={title}>{actions}</PageTitle>
      {shown === 'notLive' && (
        <NotLiveStrip
          words={W.notLive}
          onTry={() => {
            setShown('figures');
          }}
        />
      )}
      {children}
    </>
  );
}

export function PrintAction({ onPrint }: { onPrint: () => void }) {
  return (
    <button type="button" className="desk-text" onClick={onPrint}>
      <PrintMark size={17} />
      {W.print}
    </button>
  );
}

export function OnPaper({ children }: { children: ReactNode }) {
  return createPortal(
    <div className="plan-print" aria-hidden="true">
      {children}
    </div>,
    document.body,
  );
}

function PlanBody({ event, state }: { event: SampleEvent; state: string }) {
  const kind = kindOf(state);
  const sample = sampleOf(state);
  const { printing, print } = usePrint();

  const pairs =
    kind === 'after'
      ? afterPairs(sample, true)
      : kind === 'unrecorded'
        ? afterPairs(sample, false)
        : planPairs(sample);

  return (
    <PlanAround
      title={W.title}
      first={shownOf(state)}
      words={{ loading: W.loading, failed: W.failed }}
      event={event}
      emptyLine={W.emptyLine}
      actions={<PrintAction onPrint={print} />}
    >
      {kind === 'unrecorded' && <InfoLine>{W.unrecorded}</InfoLine>}
      <div className="plan-card">
        <BudgetCard event={event} label={W.title}>
          <GlassTags tags={[{ word: W.title }]} />
          <CardPairs pairs={pairs} />
        </BudgetCard>
      </div>
      <Columns
        left={
          <>
            <ByCategory rows={planRows(sample)} />
            <Across rows={acrossRows(sample)} />
          </>
        }
        right={
          <Rows>
            <li>
              <BudgetRow
                title={W.print}
                lines={[W.printLine]}
                lead={<PrintMark size={20} quiet />}
                onOpen={print}
              />
            </li>
          </Rows>
        }
      />
      {printing && (
        <OnPaper>
          <PrintSheet event={event} sample={sample} />
        </OnPaper>
      )}
    </PlanAround>
  );
}

function Facts({ facts }: { facts: readonly Fact[] }) {
  return facts.map((fact, index) => (
    <span key={fact.words} className={fact.notKnown === true ? 'plan-not-known' : undefined}>
      {index > 0 && ' · '}
      {fact.notKnown === true && <DashedMark />}
      {fact.words}
    </span>
  ));
}

function ByCategory({ rows, paper = false }: { rows: readonly PlanRow[]; paper?: boolean }) {
  return (
    <Block title={W.byCategory}>
      <Rows>
        {rows.map((row) => {
          const said = {
            title: row.name,
            lines: [<Facts key="facts" facts={row.facts} />],
            end: (
              <>
                <span className="desk-unseen">{W.planned}</span>
                <Amount value={money(row.planned)} />
              </>
            ),
          };

          return (
            <li key={row.category}>
              {paper || row.vendorId == null ? (
                <BudgetRow {...said} />
              ) : (
                <BudgetRow {...said} to={budgetAt(undefined, { vendor: row.vendorId })} />
              )}
            </li>
          );
        })}
      </Rows>
    </Block>
  );
}

/** A cost's planned figure only: a quote's figures are never split across its costs. */
export function CostEnd({ cost }: { cost: AcrossCost }) {
  if (cost.state === 'notPriced')
    return <MarkWord mark={<DashedMark />} word={BUDGET_WORDS.notPriced} />;
  if (cost.state === 'nothingYet')
    return <MarkWord mark={<OpenMark />} word={BUDGET_WORDS.notCounted} />;

  return <Amount value={money(cost.settled)} />;
}

function acrossEnd(row: AcrossRow): ReactNode {
  if (row.planned == null) return <span className="plan-nothing">{W.nothingPlannedShort}</span>;

  return (
    <>
      <span className="desk-unseen">{W.planned}</span>
      {row.notPriced === 0 ? (
        <Amount value={money(row.planned)} />
      ) : (
        <Amount value={money(row.planned)} line={BUDGET_WORDS.notPricedCount(row.notPriced)} />
      )}
    </>
  );
}

/** A quote over costs in two or more categories, or over none: a row of its own, by vendor name, in no category. */
function Across({ rows, paper = false }: { rows: readonly AcrossRow[]; paper?: boolean }) {
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const id = useId();

  if (rows.length === 0) return null;

  function flip(vendorId: string): void {
    setOpened((was) => {
      const next = new Set(was);
      if (!next.delete(vendorId)) next.add(vendorId);
      return next;
    });
  }

  return (
    <Block title={W.across}>
      <Rows>
        {rows.map((row) => {
          const said = {
            title: row.vendor,
            lines: [
              row.categories,
              row.figures,
              <span key="against">
                {`${W.againstPlanIs}: `}
                <Facts facts={row.against} />
              </span>,
            ],
            end: acrossEnd(row),
          };

          const opens = row.costs.length > 0;
          const open = paper || opened.has(row.vendorId);
          const costsId = `${id}-${row.vendorId}`;

          return (
            <li key={row.vendorId}>
              <div className="plan-quote">
                {paper || !QUOTED.has(row.vendorId) ? (
                  <BudgetRow {...said} />
                ) : (
                  <BudgetRow {...said} to={budgetAt(undefined, { vendor: row.vendorId })} />
                )}
                {opens && !paper && (
                  <button
                    type="button"
                    className="plan-open"
                    aria-label={W.costsOf(row.vendor)}
                    aria-expanded={open}
                    aria-controls={costsId}
                    onClick={() => flip(row.vendorId)}
                  >
                    <Glyph name={open ? 'chevup' : 'chevdown'} size={18} weight={2.3} />
                  </button>
                )}
              </div>
              {opens && open && (
                <div id={costsId} className="plan-costs">
                  <Rows label={W.costsOf(row.vendor)}>
                    {row.costs.map((cost) => (
                      <li key={cost.id}>
                        <BudgetRow
                          title={cost.name}
                          lines={[cost.line]}
                          end={<CostEnd cost={cost} />}
                        />
                      </li>
                    ))}
                  </Rows>
                </div>
              )}
            </li>
          );
        })}
      </Rows>
    </Block>
  );
}

/** The A4 sheet: client figures only, never internal cost or margin; no navigation, no buttons. */
function PrintSheet({ event, sample }: { event: SampleEvent; sample: PlanSample }) {
  return (
    <article className="plan-sheet">
      <h1 className="plan-sheet-title">{W.sheetTitle(event.name)}</h1>
      <p className="plan-sheet-line">{printedLine()}</p>
      <Rows>
        {sheetFigures(sample).map((one) => (
          <li key={one.label}>
            <BudgetRow title={one.label} end={<Amount value={one.amount} />} />
          </li>
        ))}
      </Rows>
      <ByCategory rows={planRows(sample)} paper />
      <Across rows={acrossRows(sample)} paper />
    </article>
  );
}

/** Print, drawn here: the product's icon set has none. */
function PrintMark({ size, quiet = false }: { size: number; quiet?: boolean }) {
  return (
    <svg
      className={quiet ? 'plan-mark is-quiet' : 'plan-mark'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9V2h12v7" />
      <rect x={6} y={14} width={12} height={8} rx={1} />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}
