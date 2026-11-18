import { OnCard, TextAction } from '../components/SettingsParts.tsx';
import {
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
import { planningOf, sampleOf, shownOf } from './plan.ts';
import { CostEnd, PlanAround } from './Plan.tsx';
import { PLAN_WORDS as W } from './planWords.ts';

/** What it will cost (sc-89, without `vendors`): sc-84's range and every cost, complete on its own; no comparison, no empty column. */
export function PlanningPage({ event, state }: { event: SampleEvent; state: string }) {
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
              left={
                <Block title={W.costsByCategory}>
                  {read.categories.map((group) => (
                    <div key={group.category} className="bud-cat">
                      <CategoryHead name={group.name} />
                      <Rows>
                        {group.costs.map((cost) => (
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
                  ))}
                </Block>
              }
              right={
                <Block title={W.trackTitle}>
                  <InfoLine>{W.trackLine}</InfoLine>
                  <TextAction label={W.seePlans} onClick={() => tell(W.plansTold)} />
                </Block>
              }
            />
          </PlanAround>
        );
      }}
    </BudgetShell>
  );
}
