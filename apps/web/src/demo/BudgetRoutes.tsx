import { useSearchParams } from 'react-router';

import { BudgetShell } from './BudgetParts.tsx';
import { DECIDE_STATES } from './decide.ts';
import { DecidePage } from './Decide.tsx';
import { type SampleEvent } from './events.ts';
import { PAYERS_STATES } from './payers.ts';
import { PayersPage } from './Payers.tsx';
import { PLAN_STATES } from './plan.ts';
import { PlanPage } from './Plan.tsx';
import { BudgetArea } from './Quotes.tsx';
import { SHARE_STATES } from './share.ts';
import { SharePage } from './Share.tsx';
import { TEMPLATES_STATES } from './templates.ts';
import { TemplatesPage } from './Templates.tsx';

/** An event's Budget at `?area=budget`: each `?state=` opens the page its board draws it on. */
export function BudgetEntry({ event }: { event: SampleEvent }) {
  const [params] = useSearchParams();
  const state = params.get('state') ?? '';
  const key = params.toString();

  if (PAYERS_STATES.includes(state)) return <PayersPage key={key} event={event} state={state} />;
  if (SHARE_STATES.includes(state)) return <SharePage key={key} event={event} state={state} />;
  if (PLAN_STATES.includes(state)) return <PlanPage key={key} event={event} state={state} />;
  if (TEMPLATES_STATES.includes(state))
    return <TemplatesPage key={key} event={event} state={state} />;
  if (DECIDE_STATES.includes(state)) return <DecidePage key={key} event={event} state={state} />;

  return (
    <BudgetShell key={key} event={event}>
      {(tell) => <BudgetArea event={event} tell={tell} />}
    </BudgetShell>
  );
}
