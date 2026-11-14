import { useEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';

import {
  Amount,
  Block,
  BudgetCard,
  BudgetRow,
  BudgetShell,
  CardPairs,
  Columns,
  DashedMark,
  GlassTags,
  InfoLine,
  PageTitle,
  Rows,
} from './BudgetParts.tsx';
import { budgetAt } from './budgetSample.ts';
import { BUDGET_WORDS } from './budgetWords.ts';
import { type SampleEvent } from './events.ts';
import { money } from './budget.ts';
import {
  type PlanRow,
  afterPairs,
  kindOf,
  planPairs,
  planRows,
  printedLine,
  sheetFigures,
} from './plan.ts';
import { PLAN_WORDS as W } from './planWords.ts';
import './plan.css';

/** Against plan (sc-89): the card's four figures, By category with each quote, and Print. */
export function PlanPage({ event, state }: { event: SampleEvent; state: string }) {
  if (state === 'print')
    return (
      <main className="desk bud plan-paper">
        <PrintSheet event={event} rows={planRows()} />
      </main>
    );

  return (
    <BudgetShell
      event={event}
      trail={[{ label: BUDGET_WORDS.budget, to: budgetAt() }, { label: W.title }]}
    >
      {() => <PlanBody event={event} state={state} />}
    </BudgetShell>
  );
}

function PlanBody({ event, state }: { event: SampleEvent; state: string }) {
  const kind = kindOf(state);
  const rows = planRows(kind === 'unknown');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);

    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);

    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  function print(): void {
    flushSync(() => setPrinting(true));
    window.print();
  }

  return (
    <>
      <PageTitle title={W.title}>
        <button type="button" className="desk-text" onClick={print}>
          <PrintMark size={17} />
          {W.print}
        </button>
      </PageTitle>
      {kind === 'unrecorded' && <InfoLine>{W.unrecorded}</InfoLine>}
      <div className="plan-card">
        <BudgetCard event={event} label={W.title}>
          <GlassTags tags={[{ word: W.title }]} />
          <CardPairs pairs={kind === 'after' ? afterPairs() : planPairs()} />
        </BudgetCard>
      </div>
      <Columns
        left={<ByCategory rows={rows} />}
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
      {printing &&
        createPortal(
          <div className="plan-print" aria-hidden="true">
            <PrintSheet event={event} rows={rows} />
          </div>,
          document.body,
        )}
    </>
  );
}

function Facts({ row }: { row: PlanRow }) {
  return row.facts.map((fact, index) => (
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
            lines: [<Facts key="facts" row={row} />],
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

/** The A4 sheet: client figures only, never internal cost or margin; no navigation, no buttons. */
function PrintSheet({ event, rows }: { event: SampleEvent; rows: readonly PlanRow[] }) {
  return (
    <article className="plan-sheet">
      <h1 className="plan-sheet-title">{W.sheetTitle(event.name)}</h1>
      <p className="plan-sheet-line">{printedLine()}</p>
      <Rows>
        {sheetFigures().map((one) => (
          <li key={one.label}>
            <BudgetRow title={one.label} end={<Amount value={one.amount} />} />
          </li>
        ))}
      </Rows>
      <ByCategory rows={rows} paper />
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
