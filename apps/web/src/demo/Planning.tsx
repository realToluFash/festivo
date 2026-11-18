import { OnCard, TextAction } from '../components/SettingsParts.tsx';
import {
  Amount,
  Block,
  BudgetCard,
  BudgetRow,
  BudgetShell,
  CardPairs,
  CategoryHead,
  Columns,
  DashedMark,
  Figure,
  GlassTags,
  InfoLine,
  Rows,
} from './BudgetParts.tsx';
import { budgetAt } from './budgetSample.ts';
import { BUDGET_WORDS } from './budgetWords.ts';
import { type SampleEvent } from './events.ts';
import { planningOf, printedLine, sampleOf, shownOf } from './plan.ts';
import { CostEnd, OnPaper, PlanAround, PrintAction } from './Plan.tsx';
import { PLAN_WORDS as W } from './planWords.ts';
import { usePrint } from './usePrint.ts';

/** What it will cost (sc-89, without `vendors`): sc-84's range and every cost, complete on its own; no comparison, no empty column. */
export function PlanningPage({ event, state }: { event: SampleEvent; state: string }) {
  const { printing, print } = usePrint();

  if (state === 'planning_print')
    return (
      <main className="desk bud plan-paper">
        <PlanningSheet event={event} state={state} />
      </main>
    );

  return (
    <BudgetShell
      event={event}
      trail={[{ label: BUDGET_WORDS.budget, to: budgetAt() }, { label: W.planningTitle }]}
    >
      {(tell) => {
        const read = planningOf(sampleOf(state));

        return (
          <PlanAround
            title={W.planningTitle}
            first={shownOf(state)}
            words={{ loading: W.planningLoading, failed: W.planningFailed }}
            event={event}
            emptyLine={W.planningEmptyLine}
            actions={<PrintAction onPrint={print} />}
          >
            <div className="plan-card">
              <BudgetCard event={event} label={W.planningTitle}>
                <GlassTags
                  tags={
                    read.notPriced === 0
                      ? []
                      : [
                          {
                            mark: <DashedMark glass />,
                            word: BUDGET_WORDS.notPricedCount(read.notPriced),
                          },
                        ]
                  }
                />
                <Figure>{read.range}</Figure>
                <OnCard>{BUDGET_WORDS.rangeLine}</OnCard>
                <CardPairs pairs={read.pairs} />
              </BudgetCard>
            </div>
            <Columns
              left={<Costs categories={read.categories} />}
              right={
                <Block title={W.trackTitle}>
                  <InfoLine>{W.trackLine}</InfoLine>
                  <TextAction label={W.seePlans} onClick={() => tell(W.plansTold)} />
                </Block>
              }
            />
            {printing && (
              <OnPaper>
                <PlanningSheet event={event} state={state} />
              </OnPaper>
            )}
          </PlanAround>
        );
      }}
    </BudgetShell>
  );
}

function Costs({ categories }: { categories: ReturnType<typeof planningOf>['categories'] }) {
  return (
    <Block title={W.costsByCategory}>
      {categories.map((group) => (
        <div key={group.category} className="bud-cat">
          <CategoryHead name={group.name} />
          <Rows>
            {group.costs.map((cost) => (
              <li key={cost.id}>
                <BudgetRow title={cost.name} lines={[cost.line]} end={<CostEnd cost={cost} />} />
              </li>
            ))}
          </Rows>
        </div>
      ))}
    </Block>
  );
}

/** One A4 sheet: the range and its count, per head both ways and every cost; no tracking card, no buttons. */
function PlanningSheet({ event, state }: { event: SampleEvent; state: string }) {
  const read = planningOf(sampleOf(state));

  return (
    <article className="plan-sheet">
      <h1 className="plan-sheet-title">{W.planningSheetTitle(event.name)}</h1>
      <p className="plan-sheet-line">{printedLine()}</p>
      <Rows>
        <li>
          <BudgetRow
            title={W.planningTitle}
            lines={[
              BUDGET_WORDS.rangeLine,
              ...(read.notPriced === 0 ? [] : [BUDGET_WORDS.notPricedCount(read.notPriced)]),
            ]}
            end={<Amount value={read.range} />}
          />
        </li>
        {read.pairs.map((pair) => (
          <li key={pair.label}>
            <BudgetRow title={pair.label} lines={[pair.sub]} end={<Amount value={pair.figure} />} />
          </li>
        ))}
      </Rows>
      <Costs categories={read.categories} />
    </article>
  );
}
