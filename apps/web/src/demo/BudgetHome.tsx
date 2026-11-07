import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import {
  CardStep,
  Field,
  Mark,
  OnCard,
  RowWords,
  Says,
  TextAction,
  type Tell,
} from '../components/SettingsParts.tsx';
import {
  type CostLine,
  type Payment,
  CURRENCY,
  PAYMENTS,
  QUOTES,
  costLine,
  dueList,
  lineState,
  money,
  overdue,
  plan,
  rateWords,
  shortDay,
  TODAY,
  whole,
  wholeRange,
} from './budget.ts';
import {
  type Heads,
  CEILING_KEYS,
  categoryCeilingsLine,
  ceilingExample,
  ceilingName,
  ceilingOf,
  ceilingProblem,
  ceilingsOf,
  fieldsWrong,
  headsOf,
  lineAmounts,
  linesOf,
  markupProblem,
  minorOf,
  rateProblem,
  removedWords,
  sumLines,
} from './budgetHome.ts';
import {
  AlertInset,
  Amount,
  Block,
  BudgetCard,
  BudgetDialog,
  BudgetLoading,
  BudgetRow,
  BudgetShell,
  CardLink,
  CardPairs,
  CardStrong,
  CategoryHead,
  Columns,
  DashedMark,
  Figure,
  GlassTags,
  InfoLine,
  LiveLine,
  MarkWord,
  MoneyField,
  NotLiveStrip,
  OpenMark,
  Opened,
  PageTitle,
  ReadOnlyLine,
  RingMark,
  Rows,
  StateTag,
  UndoBar,
  stateWord,
} from './BudgetParts.tsx';
import {
  type CeilingKey,
  MARGIN,
  PAYERS,
  budgetAt,
  ceilingSentence,
  noPayer,
  planOf,
  viewerOf,
} from './budgetSample.ts';
import { BUDGET_WORDS as W } from './budgetWords.ts';
import { type SampleEvent } from './events.ts';
import { SaveTemplateDialog } from './Templates.tsx';
import { type Category } from './vendors.ts';
import { CATEGORY_WORDS } from './vendorsWords.ts';
import './budgetHome.css';

const BUSY_MS = 900;

const VENDOR: Record<string, { name: string; category: string; contact: string }> = {
  v3: { name: 'Bloom & Co', category: 'Flowers', contact: 'Ngozi Eze' },
  v4: { name: 'Savour Kitchen', category: 'Catering', contact: 'Kofi Mensah' },
  v5: { name: 'The Landmark', category: 'Venue', contact: 'Priya Shah' },
  v6: { name: 'Lens & Light', category: 'Photography', contact: 'Marco Rossi' },
};

const vendorName = (id: string): string => VENDOR[id]?.name ?? id;

const FIRST_KNOWS =
  '96 guests have said yes and the event runs 3 days, Thursday, Nov 5 to Saturday, Nov 7. There is no seating plan yet. Each cost you add takes its quantity from these, so nobody types a count in.';

type Dialog = 'addCost' | 'ceiling' | 'markup' | 'dueNow' | 'save' | null;

interface Removed {
  line: CostLine;
  index: number;
  words: string;
}

function dialogOf(state: string): Dialog {
  if (state.startsWith('add_cost')) return 'addCost';
  if (state.startsWith('markup')) return 'markup';
  if (state.startsWith('due_')) return 'dueNow';
  if (state.startsWith('save_')) return 'save';
  if (
    ['ceiling_set', 'ceiling_change', 'ceiling_negative', 'ceiling_currency'].includes(state) ||
    ['ceiling_nan', 'ceiling_decimals'].includes(state)
  )
    return 'ceiling';

  return null;
}

function openedOf(state: string): string | null {
  if (state.startsWith('rate_') && state !== 'rate_saved' && state !== 'rate_failed')
    return 'dinner';
  if (state === 'add_price') return 'arch';
  if (state === 'margin') return 'dj';

  return null;
}

function removedOf(state: string, heads: Heads): Removed | null {
  const id = { removed_priced: 'dj', removed_not_priced: 'arch', removed_nothing_yet: 'centre' }[
    state as 'removed_priced'
  ];
  const all = linesOf('populated');
  const index = all.findIndex((one) => one.id === id);
  const line = all[index];

  return line == null
    ? null
    : { line, index, words: removedWords(line, lineAmounts(line, heads).settled) };
}

/** Not on the event's Budget: Can edit, Can view or Can check guests in see the event's not-found page. */
export function NotAvailablePage({ event }: { event: SampleEvent }) {
  return (
    <BudgetShell event={event} area="overview" trail={[{ label: 'Not available' }]}>
      {() => <NotAvailable />}
    </BudgetShell>
  );
}

function NotAvailable() {
  return (
    <div className="bud-gone">
      <h1 className="bud-title" tabIndex={-1}>
        This event is not available
      </h1>
      <Link className="desk-text" to="/demo/events">
        <Glyph name="back" size={17} weight={2.4} />
        Back to Events
      </Link>
    </div>
  );
}

/** The event's Budget at a desk in A: the card across, the costs at the left, what is due, the ceiling and the rest at the right. */
export function BudgetHomeContent({
  event,
  state: first,
  tell,
  titleRef,
  dueNext,
  vendorsQuoted,
}: {
  event: SampleEvent;
  state: string;
  tell: Tell;
  titleRef: RefObject<HTMLHeadingElement | null>;
  dueNext: ReactNode;
  vendorsQuoted: ReactNode;
}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const viewer = viewerOf(params.get('as'));
  const enterprise = planOf(params.get('plan')) === 'enterprise';
  const currency = params.get('currency') ?? CURRENCY;
  const [state, setState] = useState(first);
  const [lines, setLines] = useState(() => linesOf(first));
  const heads = headsOf(first);
  const [ceilings, setCeilings] = useState(() => ceilingsOf(first));
  const [listed, setListed] = useState(first === 'ceiling_saved');
  const [opened, setOpened] = useState<string | null>(() => openedOf(first));
  const [removed, setRemoved] = useState<Removed | null>(() => removedOf(first, heads));
  const [dialog, setDialog] = useState<Dialog>(() => dialogOf(first));
  const [lit, setLit] = useState<string | null>(first === 'rate_saved' ? 'dinner' : null);
  const [line, setLine] = useState<{ id: string; words: string; ok: boolean } | null>(() =>
    first === 'rate_saved'
      ? { id: 'dinner', words: 'Saved.', ok: true }
      : first === 'rate_failed'
        ? { id: 'dinner', words: 'Not saved. The rate is back to £68.00 a head.', ok: false }
        : null,
  );
  const margin = enterprise && (first === 'margin' || first.startsWith('markup'));
  const readOnly = first === 'read_only';
  const live = first !== 'not_live';
  const empty = lines.length === 0;

  if (state === 'loading')
    return (
      <>
        <PageTitle title={W.budget} titleRef={titleRef} />
        <BudgetLoading />
      </>
    );

  if (state === 'failed')
    return (
      <>
        <PageTitle title={W.budget} titleRef={titleRef} />
        <p className="desk-line is-ink">
          The budget did not load. Check your connection and try again.
        </p>
        <TextAction
          label="Try again"
          onClick={() => {
            setState('loading');
            window.setTimeout(() => setState('populated'), BUSY_MS);
          }}
        />
      </>
    );

  const sum = sumLines(lines, heads);
  const due = dueList(PAYMENTS, vendorName);
  const next = due[0] ?? null;

  return (
    <>
      <PageTitle title={W.budget} titleRef={titleRef}>
        <TextAction label="Add a cost" before="plus" onClick={() => setDialog('addCost')} />
        {!empty && (
          <>
            <Link className="desk-text" to={budgetAt('payers')}>
              Who is paying
            </Link>
            <Link className="desk-text" to={budgetAt('links')}>
              <ShareGlyph />
              Share
            </Link>
          </>
        )}
      </PageTitle>
      {first === 'live_heads' && (
        <LiveLine words="2 more guests said yes, so the settled total went up by £180." />
      )}
      {!live && (
        <NotLiveStrip
          words="Not live. Figures as of 09:32, 9 minutes ago."
          onTry={() => void navigate(budgetAt('populated'))}
        />
      )}
      {readOnly && (
        <ReadOnlyLine
          {...(viewer.key === 'folake'
            ? { onPlans: () => tell('Plans have their own design.') }
            : {})}
        />
      )}
      {empty ? (
        <FirstCard
          event={event}
          start={first !== 'nothing_to_start'}
          onAdd={() => setDialog('addCost')}
          onStart={() => void navigate(budgetAt('start_from'))}
        />
      ) : margin ? (
        <MarginCard event={event} />
      ) : (
        <SummaryCard
          event={event}
          sum={sum}
          heads={heads}
          washed={first === 'live_heads' || first === 'rate_saved'}
          ceiling={
            ceilings.whole == null ? null : ceilingOf('whole', ceilings.whole, lines, heads).state
          }
          next={live && !readOnly ? next : null}
          onMark={(payment) => void navigate(budgetAt('mark_paid', { vendor: payment.vendorId }))}
        />
      )}
      {empty ? (
        <Columns
          left={
            <Block title="Who is paying">
              <p className="desk-line">
                No payers yet. Payers are who covers each cost: the couple, both sets of parents, an
                aunt covering the cars.
              </p>
              <Link className="desk-text" to={budgetAt('no_payers')}>
                <Glyph name="plus" size={17} weight={2.3} />
                Add a payer
              </Link>
            </Block>
          }
          right={
            <Block title="Share">
              <p className="desk-line">No links yet.</p>
              <Link className="desk-text" to={budgetAt('no_links')}>
                <Glyph name="plus" size={17} weight={2.3} />
                Create a link
              </Link>
            </Block>
          }
        />
      ) : (
        <Columns
          left={
            margin ? (
              <MarginCosts lines={lines} heads={heads} first={first} />
            ) : (
              <Costs
                lines={lines}
                heads={heads}
                ceilings={ceilings}
                opened={opened}
                first={first}
                lit={lit}
                line={line}
                removed={removed}
                onOpen={(id) => {
                  setOpened((now) => (now === id ? null : id));
                  setLine(null);
                }}
                onClose={() => setOpened(null)}
                onSaved={(next_, id, words, ok) => {
                  setLines(next_);
                  setOpened(null);
                  setLit(ok ? id : null);
                  setLine({ id, words, ok });
                  setRemoved(null);
                }}
                onRemove={(gone) => {
                  setLines((now) => now.filter((one) => one.id !== gone.line.id));
                  setOpened(null);
                  setRemoved(gone);
                }}
                onUndo={() => {
                  if (removed == null) return;
                  setLines((now) => {
                    const back = [...now];
                    back.splice(removed.index, 0, removed.line);
                    return back;
                  });
                  setLit(removed.line.id);
                  setRemoved(null);
                }}
              />
            )
          }
          right={
            margin ? (
              <MarginBlocks />
            ) : (
              <>
                {dueNext}
                <CeilingBlock
                  ceilings={ceilings}
                  listed={listed}
                  lines={lines}
                  heads={heads}
                  onChange={() => setDialog('ceiling')}
                />
                <AgainstPlan lines={lines} />
                <WhoIsPaying />
                {vendorsQuoted}
                <FromOtherEvents onSave={() => setDialog('save')} />
              </>
            )
          }
        />
      )}
      {dialog === 'addCost' && (
        <AddCostDialog
          first={first}
          onDismiss={() => setDialog(null)}
          onAdded={(added) => {
            setLines((now) => [...now, added]);
            setDialog(null);
            setLit(added.id);
            setLine({ id: added.id, words: 'Saved.', ok: true });
          }}
        />
      )}
      {dialog === 'ceiling' && (
        <CeilingSheet
          first={first}
          currency={currency}
          ceilings={ceilings}
          onDismiss={() => setDialog(null)}
          onSaved={(next_) => {
            setCeilings(next_);
            setListed(true);
            setDialog(null);
            tell('Ceiling saved.');
          }}
        />
      )}
      {dialog === 'markup' && <MarkupDialog first={first} onDismiss={() => setDialog(null)} />}
      {dialog === 'save' && (
        <SaveTemplateDialog
          start={
            first === 'save_taken'
              ? 'taken'
              : first === 'save_blank'
                ? 'blank'
                : first === 'save_long'
                  ? 'long'
                  : null
          }
          onDismiss={() => setDialog(null)}
          onSaved={() => setDialog(null)}
        />
      )}
      {dialog === 'dueNow' && (
        <DueNowDialog event={event} first={first} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

function ShareGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M6 13l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function possessive(payment: Payment): string {
  return `${vendorName(payment.vendorId)}’s ${payment.what.toLowerCase()}, ${whole(payment.amount)}`;
}

function needsYou(payment: Payment): string {
  if (overdue(payment)) return `${possessive(payment)}, was due ${shortDay(payment.dueOn)}.`;
  const tomorrow = new Date(`${TODAY}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const when =
    payment.dueOn === TODAY
      ? `today, ${shortDay(payment.dueOn)}`
      : payment.dueOn === tomorrow.toISOString().slice(0, 10)
        ? `tomorrow, ${shortDay(payment.dueOn)}`
        : shortDay(payment.dueOn);

  return `${possessive(payment)}, is due ${when}.`;
}

function SummaryCard({
  event,
  sum,
  heads,
  washed,
  ceiling,
  next,
  onMark,
}: {
  event: SampleEvent;
  sum: { settled: number; ifAll: number; notPriced: number };
  heads: Heads;
  washed: boolean;
  ceiling: ReturnType<typeof ceilingOf>['state'] | null;
  next: Payment | null;
  onMark: (payment: Payment) => void;
}) {
  const tags = [
    ...(ceiling == null
      ? []
      : [{ mark: <RingMark state={ceiling} glass />, word: stateWord(ceiling) }]),
    ...(sum.notPriced === 0
      ? []
      : [{ mark: <DashedMark glass />, word: W.notPricedCount(sum.notPriced) }]),
  ];

  return (
    <BudgetCard event={event} label={W.budget}>
      <GlassTags tags={tags} />
      <Figure flash={washed}>{wholeRange(sum.settled, sum.ifAll)}</Figure>
      <OnCard>{W.rangeLine}</OnCard>
      <CardPairs
        pairs={[
          heads.coming === 0
            ? { label: 'Per head, settled', figure: 'No figure yet', sub: 'Nobody has said yes' }
            : {
                label: 'Per head, settled',
                figure: whole(Math.round(sum.settled / heads.coming)),
                sub: `${heads.coming} coming`,
              },
          {
            label: 'Per head, if all come',
            figure: whole(Math.round(sum.ifAll / heads.ifAllCome)),
            sub: `${heads.ifAllCome} coming`,
          },
        ]}
      />
      {next != null && (
        <div className="bud-card-foot">
          <CardStrong>{needsYou(next)}</CardStrong>
          <CardStep label={W.markPaid} onClick={() => onMark(next)} />
        </div>
      )}
    </BudgetCard>
  );
}

function FirstCard({
  event,
  start,
  onAdd,
  onStart,
}: {
  event: SampleEvent;
  start: boolean;
  onAdd: () => void;
  onStart: () => void;
}) {
  return (
    <BudgetCard event={event} label={W.budget}>
      <Says>No costs yet</Says>
      <OnCard>{FIRST_KNOWS}</OnCard>
      <div className="bud-card-foot">
        <CardStep label="Add the first cost" onClick={onAdd} />
        {start && <CardLink label="Start from an earlier budget" onClick={onStart} />}
      </div>
    </BudgetCard>
  );
}

function MarginCard({ event }: { event: SampleEvent }) {
  return (
    <BudgetCard event={event} label={W.budget}>
      <GlassTags
        tags={[
          { word: 'Enterprise' },
          { word: 'Only owners, admins and this event’s lead see this' },
        ]}
      />
      <CardPairs
        pairs={[
          {
            label: 'Client total',
            figure: wholeRange(...MARGIN.client),
            sub: 'What the client pays',
          },
          { label: 'Internal cost', figure: wholeRange(...MARGIN.cost), sub: 'What it costs you' },
          {
            label: 'Margin',
            figure: wholeRange(...MARGIN.margin),
            sub: `${MARGIN.marginShare[0]} to ${MARGIN.marginShare[1]} of the client total`,
          },
          {
            label: 'Margin after payments',
            figure: wholeRange(...MARGIN.after),
            sub: `${MARGIN.afterShare[0]} to ${MARGIN.afterShare[1]}`,
          },
        ]}
      />
      <OnCard>Never on a share or a printout.</OnCard>
    </BudgetCard>
  );
}

function costEnd(line: CostLine, heads: Heads): ReactNode {
  if (lineState(line) === 'notPriced') return <MarkWord mark={<DashedMark />} word={W.notPriced} />;
  if (lineState(line) === 'nothingYet') return <MarkWord mark={<OpenMark />} word={W.notCounted} />;

  return <Amount value={money(lineAmounts(line, heads).settled)} />;
}

function rowLine(line: CostLine, heads: Heads): string {
  return line.basis === 'perHead' && lineState(line) === 'priced'
    ? `${rateWords(line) ?? ''} × ${heads.coming} · said yes, from the guest list`
    : costLine(line);
}

function categoryTag(
  category: Category,
  ceilings: Partial<Record<CeilingKey, number>>,
  lines: readonly CostLine[],
  heads: Heads,
): ReactNode {
  const ceiling = ceilings[category];

  return ceiling == null ? undefined : (
    <StateTag state={ceilingOf(category, ceiling, lines, heads).state} />
  );
}

function Costs({
  lines,
  heads,
  ceilings,
  opened,
  first,
  lit,
  line,
  removed,
  onOpen,
  onClose,
  onSaved,
  onRemove,
  onUndo,
}: {
  lines: CostLine[];
  heads: Heads;
  ceilings: Partial<Record<CeilingKey, number>>;
  opened: string | null;
  first: string;
  lit: string | null;
  line: { id: string; words: string; ok: boolean } | null;
  removed: Removed | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  onSaved: (lines: CostLine[], id: string, words: string, ok: boolean) => void;
  onRemove: (gone: Removed) => void;
  onUndo: () => void;
}) {
  const categories = (Object.keys(CATEGORY_WORDS) as Category[]).filter((category) =>
    lines.some((one) => one.category === category),
  );

  return (
    <Block title={W.costs}>
      {removed != null && <UndoBar words={removed.words} onUndo={onUndo} />}
      {categories.map((category) => (
        <div key={category} className="bud-cat">
          <CategoryHead
            name={CATEGORY_WORDS[category]}
            tag={categoryTag(category, ceilings, lines, heads)}
          />
          <Rows>
            {lines
              .filter((one) => one.category === category)
              .map((one) => (
                <li key={one.id}>
                  {opened === one.id ? (
                    <OpenedCost
                      line={one}
                      lines={lines}
                      heads={heads}
                      ceilings={ceilings}
                      first={first}
                      onCancel={onClose}
                      onSaved={onSaved}
                      onRemove={() =>
                        onRemove({
                          line: one,
                          index: lines.indexOf(one),
                          words: removedWords(one, lineAmounts(one, heads).settled),
                        })
                      }
                    />
                  ) : (
                    <BudgetRow
                      title={one.name}
                      lines={[rowLine(one, heads)]}
                      end={costEnd(one, heads)}
                      lit={lit === one.id}
                      open={false}
                      label={`${one.name}, ${rowLine(one, heads)}`}
                      onOpen={() => onOpen(one.id)}
                    />
                  )}
                  {line?.id === one.id && opened !== one.id && (
                    <p className={line.ok ? 'bud-said is-ok' : 'bud-said is-wrong'} role="status">
                      <Glyph name={line.ok ? 'tick' : 'clear'} size={15} weight={2.6} />
                      {line.words}
                    </p>
                  )}
                </li>
              ))}
          </Rows>
        </div>
      ))}
    </Block>
  );
}

const UNIT: Record<CostLine['basis'], string | undefined> = {
  perHead: 'a head',
  perTable: 'a table',
  perStaffHour: undefined,
  perDay: 'a day',
  fixed: undefined,
};

function startRate(first: string, line: CostLine): string {
  if (line.id !== 'dinner') return line.rate == null ? '' : (line.rate / 100).toFixed(2);

  return (
    {
      rate_editing: '70',
      rate_blank: '',
      rate_invalid: 'seventy',
      rate_decimals: '70.505',
      rate_saving: '70',
      rate_warning: '72',
    }[first] ?? '68.00'
  );
}

function OpenedCost({
  line,
  lines,
  heads,
  ceilings,
  first,
  onCancel,
  onSaved,
  onRemove,
}: {
  line: CostLine;
  lines: CostLine[];
  heads: Heads;
  ceilings: Partial<Record<CeilingKey, number>>;
  first: string;
  onCancel: () => void;
  onSaved: (lines: CostLine[], id: string, words: string, ok: boolean) => void;
  onRemove: () => void;
}) {
  const [typed, setTyped] = useState(() => startRate(first, line));
  const [problem, setProblem] = useState<string | null>(() =>
    ['rate_blank', 'rate_invalid', 'rate_decimals'].includes(first)
      ? rateProblem(startRate(first, line))
      : null,
  );
  const [busy, setBusy] = useState(first === 'rate_saving');
  const field = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const priced = lineState(line) !== 'notPriced';
  const fixed = line.basis === 'fixed';
  const unit = UNIT[line.basis];
  const label = fixed || !priced ? `Amount for ${line.name}` : `Rate for ${line.name}`;
  const quote = QUOTES.find((one) => one.lineIds.includes(line.id));
  const payers = PAYERS.filter((one) => one.covers.some((cover) => cover.lineId === line.id));
  const warning = warningOf(line, typed, lines, heads, ceilings);

  useEffect(() => field.current?.focus(), []);

  function save(): void {
    if (busy) return;
    const text = typed.trim();
    if (!priced && (text === '' || minorOf(text) === 0)) return onCancel();
    const found = rateProblem(text, fixed ? 'amount' : 'rate');
    setProblem(found);
    if (found != null) return field.current?.focus();
    setBusy(true);
    window.setTimeout(() => {
      const next = lines.map((one) => (one.id === line.id ? { ...one, rate: minorOf(text) } : one));
      onSaved(next, line.id, 'Saved.', true);
    }, BUSY_MS);
  }

  const keyed = useRef<(event: globalThis.KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    keyed.current = (event) => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        save();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
  });

  useEffect(() => {
    const node = box.current;
    if (node == null) return;
    const keys = (event: globalThis.KeyboardEvent) => keyed.current(event);
    node.addEventListener('keydown', keys);

    return () => node.removeEventListener('keydown', keys);
  }, []);

  return (
    <Opened>
      <div ref={box} className="bud-opened-cost" role="group" aria-label={line.name}>
        <p className="bud-opened-name">{line.name}</p>
        <MoneyField
          label={label}
          value={typed}
          {...(fixed || !priced || unit == null ? {} : { unit })}
          error={problem}
          inputRef={field}
          onChange={(value) => {
            setTyped(value);
            if (problem != null) setProblem(rateProblem(value, fixed ? 'amount' : 'rate'));
          }}
        />
        {warning != null && (
          <div className="bud-warn" role="status">
            <RingMark state="overIfAll" />
            <span>
              <strong>{warning[0]}</strong> {warning[1]}
            </span>
          </div>
        )}
        <p className="desk-note">
          {!priced
            ? 'Not priced yet. Saving 0 leaves it not priced.'
            : line.basis === 'perHead'
              ? `× ${heads.coming} · said yes, from the guest list. Up to ${heads.ifAllCome} if all come.`
              : line.basis === 'perTable'
                ? 'No seating plan yet, so 0 for now'
                : line.basis === 'perDay'
                  ? '× 3 · days the event runs'
                  : 'A fixed amount, counted once'}
        </p>
        {(quote != null || payers.length > 0) && (
          <Rows>
            {quote != null && (
              <li>
                <BudgetRow
                  title={`Agreed in the quote from ${vendorName(quote.vendorId)}`}
                  lines={[
                    `${money(quote.amount)} for ${quote.lineIds.map((id) => lines.find((one) => one.id === id)?.name ?? id).join(' and ')}`,
                  ]}
                  to={budgetAt(undefined, { vendor: quote.vendorId })}
                />
              </li>
            )}
            <li>
              <div className="desk-row bud-row">
                <span className="desk-row-words">
                  <span className="desk-row-title">
                    <span className="desk-row-name">Who pays</span>
                  </span>
                  <span className="desk-row-line">
                    {payers.length === 0
                      ? 'No payer yet'
                      : payers.length === 1
                        ? `${payers[0]?.name ?? ''}, all of it`
                        : `${payers.map((one) => one.name).join(' and ')}, half each`}
                  </span>
                </span>
                <Link className="desk-text" to={budgetAt('choose_one')}>
                  Choose who pays
                </Link>
              </div>
            </li>
          </Rows>
        )}
        <div className="bud-opened-actions">
          <TextAction label={W.cancel} onClick={onCancel} />
          <button
            type="button"
            className={busy ? 'desk-text is-off' : 'desk-text'}
            aria-disabled={busy}
            onClick={save}
          >
            {busy ? W.saving : W.save}
          </button>
          <TextAction label={W.remove} red onClick={onRemove} />
        </div>
      </div>
    </Opened>
  );
}

function warningOf(
  line: CostLine,
  typed: string,
  lines: readonly CostLine[],
  heads: Heads,
  ceilings: Partial<Record<CeilingKey, number>>,
): readonly [string, string] | null {
  const ceiling = ceilings.whole;
  if (ceiling == null || rateProblem(typed) != null || line.rate == null) return null;
  const rate = minorOf(typed);
  if (rate <= line.rate) return null;
  const next = sumLines(
    lines.map((one) => (one.id === line.id ? { ...one, rate } : one)),
    heads,
  );
  const unit = UNIT[line.basis];
  const said = unit == null ? whole(rate) : whole(rate);

  if (next.settled > ceiling)
    return [
      `${said} takes the event over its ceiling.`,
      `Settled, it would be ${whole(next.settled)} against ${whole(ceiling)}. You can still save it.`,
    ];
  if (next.ifAll > ceiling)
    return [
      `${said} takes the event over its ceiling.`,
      `If everyone comes, it would be ${whole(next.ifAll)} against ${whole(ceiling)}. You can still save it.`,
    ];

  return null;
}

function MarginCosts({ lines, heads, first }: { lines: CostLine[]; heads: Heads; first: string }) {
  const [opened, setOpened] = useState<string | null>(first === 'margin' ? 'dj' : null);
  const [charged, setCharged] = useState('800');
  const markup: Partial<Record<Category, number>> = {
    catering: 20,
    venue: 0,
    flowers: 20,
    photography: 15,
    music: 20,
    transport: 20,
  };
  const how = (category: Category) =>
    category === 'venue'
      ? 'at cost, chosen'
      : category === 'photography'
        ? '15% markup, Photography’s'
        : '20% markup, the event’s';
  const priced = lines.filter((one) => lineState(one) === 'priced');
  const groups = (Object.keys(CATEGORY_WORDS) as Category[]).filter((category) =>
    priced.some((one) => one.category === category),
  );

  return (
    <Block title={W.costs}>
      {groups.map((category) => (
        <div key={category} className="bud-cat">
          <CategoryHead name={CATEGORY_WORDS[category]} />
          <Rows>
            {priced
              .filter((one) => one.category === category)
              .map((one) => {
                const cost = lineAmounts(one, heads).settled;
                const price = Math.round(cost * (1 + (markup[category] ?? 0) / 100));
                const share = price === 0 ? 0 : ((price - cost) / price) * 100;

                return (
                  <li key={one.id}>
                    {opened === one.id ? (
                      <Opened>
                        <p className="bud-opened-name">{one.name}</p>
                        <MoneyField
                          label="Charged at"
                          value={charged}
                          help={`Cost ${money(cost)}`}
                          onChange={setCharged}
                        />
                        {minorOf(charged) < cost && rateProblem(charged) == null && (
                          <p className="bud-below" role="status">
                            <DownArrow />
                            Below cost: margin {whole(minorOf(charged) - cost)}.
                          </p>
                        )}
                        <div className="bud-opened-actions">
                          <TextAction label={W.cancel} onClick={() => setOpened(null)} />
                          <TextAction label={W.save} onClick={() => setOpened(null)} />
                        </div>
                      </Opened>
                    ) : (
                      <BudgetRow
                        title={one.name}
                        lines={[
                          `Cost ${money(cost)} · Charged at ${money(price)} · ${how(category)}`,
                        ]}
                        end={<Amount value={`${share.toFixed(1)}%`} />}
                        onOpen={() => setOpened(one.id)}
                      />
                    )}
                  </li>
                );
              })}
          </Rows>
        </div>
      ))}
      <div className="bud-cat">
        <CategoryHead name="Other" />
        <Rows>
          <li>
            <BudgetRow
              title="Planning fee"
              lines={['Cost £0.00 · Charged at £3,000.00 · its own price']}
              end={<Amount value="100.0%" />}
              onOpen={() => undefined}
            />
          </li>
        </Rows>
      </div>
    </Block>
  );
}

function MarginBlocks() {
  return (
    <>
      <Block title="Markup">
        <Rows>
          {[
            ['Whole event', '20% markup'],
            ['Photography', '15% markup'],
            ['Venue', 'At cost, chosen'],
            ['Planning fee', 'Its own price'],
          ].map(([name, how]) => (
            <li key={name}>
              <BudgetRow title={name} lines={[how]} to={budgetAt('markup')} />
            </li>
          ))}
        </Rows>
      </Block>
      <Block title="Margin after payments">
        <Rows>
          <li>
            <BudgetRow
              title="Bloom & Co"
              lead={<DownArrow />}
              lines={['Took £350.00 out of the margin: £1,200.00 against £850.00 planned']}
            />
          </li>
          <li>
            <BudgetRow
              title="Savour Kitchen"
              lines={[
                'Counted at its quote, £9,000.00, as only £7,500.00 is scheduled. If the final figure is lower, revise the quote.',
              ]}
            />
          </li>
        </Rows>
      </Block>
    </>
  );
}

function CeilingBlock({
  ceilings,
  lines,
  heads,
  listed,
  onChange,
}: {
  ceilings: Partial<Record<CeilingKey, number>>;
  lines: readonly CostLine[];
  heads: Heads;
  listed: boolean;
  onChange: () => void;
}) {
  const set = CEILING_KEYS.filter((key) => ceilings[key] != null && (listed || key === 'whole'));

  return (
    <Block
      title="Ceiling"
      action={
        <TextAction
          label={set.length === 0 ? 'Set a ceiling' : 'Change the ceiling'}
          onClick={onChange}
        />
      }
    >
      {set.length === 0 ? (
        <p className="desk-line">
          No ceiling yet. Set one for the whole event, a category, or both.
        </p>
      ) : (
        <Rows>
          {set.map((key) => {
            const amount = ceilings[key] ?? 0;
            const now = ceilingOf(key, amount, lines, heads);

            return (
              <li key={key}>
                <BudgetRow
                  title={`${ceilingName(key)} · ${money(amount)}`}
                  lines={[ceilingSentence(now.settled, now.ifAll, amount)]}
                  lead={<RingMark state={now.state} />}
                  end={<StateTag state={now.state} />}
                />
              </li>
            );
          })}
        </Rows>
      )}
    </Block>
  );
}

function AgainstPlan({ lines }: { lines: readonly CostLine[] }) {
  const figures = plan(lines);
  const notPriced = lines.filter((one) => lineState(one) === 'notPriced').length;
  const rows: readonly [string, string, number][] = [
    ['Planned', W.notPricedCount(notPriced), figures.planned],
    ['Committed', 'What the vendors quoted', figures.committed],
    ['Paid', '3 payments marked paid', figures.paid],
    ['Still to pay', '5 payments scheduled', figures.stillToPay],
  ];

  return (
    <Block title="Against plan">
      <Rows>
        {rows.map(([name, said, amount]) => (
          <li key={name}>
            <BudgetRow
              title={name}
              lines={[said]}
              end={<Amount value={money(amount)} />}
              to={budgetAt('plan')}
            />
          </li>
        ))}
      </Rows>
    </Block>
  );
}

function WhoIsPaying() {
  const none = noPayer();

  return (
    <Block title="Who is paying">
      <Rows>
        <li>
          <BudgetRow
            title="Who is paying"
            lines={[`${PAYERS.length} payers · ${money(none.amount)} has no payer yet`]}
            to={budgetAt('payers')}
          />
        </li>
      </Rows>
    </Block>
  );
}

function FromOtherEvents({ onSave }: { onSave: () => void }) {
  return (
    <Block title="From other events">
      <Rows>
        <li>
          <BudgetRow
            title="Save as template"
            lines={['Its rates, for the next one like it']}
            onOpen={onSave}
          />
        </li>
        <li>
          <BudgetRow
            title="Calibration"
            lines={['What costs came to on events that are over']}
            to={budgetAt('calibration')}
          />
        </li>
      </Rows>
    </Block>
  );
}

const BASES: readonly { key: CostLine['basis']; word: string; line: string }[] = [
  {
    key: 'perHead',
    word: 'Per head',
    line: '96 said yes now, up to 133 if all come · from the guest list',
  },
  { key: 'perTable', word: 'Per table', line: 'No seating plan yet, so 0 for now' },
  {
    key: 'perStaffHour',
    word: 'Per staff hour',
    line: 'Its cost comes from Staff rates, so it takes no rate here',
  },
  { key: 'perDay', word: 'Per day', line: '3 days, from the event’s dates' },
  { key: 'fixed', word: 'A fixed amount', line: 'Counted once' },
];

function AddCostDialog({
  first,
  onDismiss,
  onAdded,
}: {
  first: string;
  onDismiss: () => void;
  onAdded: (line: CostLine) => void;
}) {
  const blank = first === 'add_cost_blank';
  const fixedStart = first === 'add_cost_fixed';
  const staff = first === 'add_cost_staff';
  const [what, setWhat] = useState(
    blank ? '' : fixedStart ? 'Aisle arch' : staff ? 'Service staff' : 'Welcome drinks',
  );
  const [category, setCategory] = useState<Category | ''>(
    blank ? '' : fixedStart ? 'flowers' : staff ? 'staffing' : 'catering',
  );
  const [note, setNote] = useState('');
  const [basis, setBasis] = useState<CostLine['basis'] | null>(
    blank ? null : fixedStart ? 'fixed' : 'perHead',
  );
  const [rate, setRate] = useState(fixedStart ? '450' : blank ? '' : '12');
  const [tried, setTried] = useState(blank);
  const [failed, setFailed] = useState(first === 'add_cost_failed');
  const [busy, setBusy] = useState(false);
  const whatRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const problems = {
    what: what.trim() === '' ? 'Enter what it is.' : null,
    category: category === '' ? 'Choose a category.' : null,
    basis: basis == null ? 'Choose how it is counted.' : null,
    rate:
      basis == null || basis === 'perStaffHour'
        ? null
        : rateProblem(rate, basis === 'fixed' ? 'amount' : 'rate'),
  };
  const shown = tried ? problems : { what: null, category: null, basis: null, rate: null };
  const count = Object.values(shown).filter((one) => one != null).length;

  function add(): void {
    if (busy) return;
    setTried(true);
    if (Object.values(problems).some((one) => one != null)) {
      if (problems.what != null) whatRef.current?.focus();
      return;
    }
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      if (failed) {
        setFailed(false);
        setTried(false);
        return;
      }
      onAdded({
        id: `new-${what.trim().toLowerCase().replace(/\s+/g, '-')}`,
        name: what.trim(),
        category: category as Category,
        basis: basis ?? 'fixed',
        rate: basis === 'perStaffHour' ? 0 : minorOf(rate),
      });
    }, BUSY_MS);
  }

  return (
    <BudgetDialog
      width={762}
      title="Add a cost"
      verb={busy ? 'Adding…' : 'Add'}
      locked={busy}
      onDismiss={onDismiss}
      onConfirm={add}
    >
      {count > 0 && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {fieldsWrong(count)}
        </p>
      )}
      {first === 'add_cost_failed' && failed && tried && (
        <AlertInset>
          Not saved. Check your connection and try again. What you typed is still here.
        </AlertInset>
      )}
      <div className="bud-two">
        <div className="bud-two-left">
          <Field
            label="What it is"
            value={what}
            onChange={setWhat}
            error={shown.what}
            inputRef={whatRef}
          />
          <div className="desk-field">
            <label htmlFor={`${id}-cat`} className="desk-label">
              Category
            </label>
            <div className={shown.category == null ? 'desk-box' : 'desk-box is-wrong'}>
              <select
                id={`${id}-cat`}
                className="bud-select"
                value={category}
                aria-invalid={shown.category != null}
                aria-describedby={shown.category == null ? undefined : `${id}-cat-error`}
                onChange={(event) => setCategory(event.target.value as Category)}
              >
                <option value="">Choose a category</option>
                {(Object.keys(CATEGORY_WORDS) as Category[]).map((one) => (
                  <option key={one} value={one}>
                    {CATEGORY_WORDS[one]}
                  </option>
                ))}
              </select>
            </div>
            {shown.category != null && (
              <p id={`${id}-cat-error`} className="desk-error">
                <Glyph name="alert" size={15} weight={2.2} />
                {shown.category}
              </p>
            )}
          </div>
          <Field label="Note · Optional" value={note} onChange={setNote} />
        </div>
        <fieldset
          className="bud-two-right bud-bases"
          aria-describedby={shown.basis == null ? undefined : `${id}-basis-error`}
        >
          <legend className="desk-label">How it is counted</legend>
          <ul className="desk-rows">
            {BASES.map((one) => {
              const taken = staff && one.key === 'perStaffHour';

              return (
                <li key={one.key}>
                  <label className={basis === one.key ? 'desk-row is-picked' : 'desk-row'}>
                    <input
                      type="radio"
                      className="desk-radio"
                      name={`${id}-basis`}
                      checked={basis === one.key}
                      disabled={taken}
                      onChange={() => setBasis(one.key)}
                    />
                    <RowWords
                      title={one.word}
                      lines={[taken ? 'The budget already has a staff-time cost.' : one.line]}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
          {shown.basis != null && (
            <p id={`${id}-basis-error`} className="desk-error">
              <Glyph name="alert" size={15} weight={2.2} />
              {shown.basis}
            </p>
          )}
          {basis != null && basis !== 'perStaffHour' && (
            <MoneyField
              label={basis === 'fixed' ? 'Amount' : 'Rate'}
              value={rate}
              {...(UNIT[basis] == null ? {} : { unit: UNIT[basis] })}
              error={shown.rate}
              onChange={setRate}
            />
          )}
        </fieldset>
      </div>
    </BudgetDialog>
  );
}

function startCeilings(first: string): Record<CeilingKey, string> {
  const values = Object.fromEntries(CEILING_KEYS.map((key) => [key, ''])) as Record<
    CeilingKey,
    string
  >;
  if (first === 'ceiling_set') return values;
  values.whole = '22,000.00';
  values.catering = '13,000.00';
  values.flowers = '1,500.00';
  values.hire = '0.00';
  const bad = {
    ceiling_negative: '−50',
    ceiling_currency: '€640',
    ceiling_nan: 'six hundred',
    ceiling_decimals: '640.505',
  }[first as 'ceiling_nan'];
  if (bad != null) values.transport = bad;

  return values;
}

function CeilingSheet({
  first,
  currency,
  ceilings,
  onDismiss,
  onSaved,
}: {
  first: string;
  currency: string;
  ceilings: Partial<Record<CeilingKey, number>>;
  onDismiss: () => void;
  onSaved: (next: Partial<Record<CeilingKey, number>>) => void;
}) {
  const [values, setValues] = useState(() => startCeilings(first));
  const refused = [
    'ceiling_negative',
    'ceiling_currency',
    'ceiling_nan',
    'ceiling_decimals',
  ].includes(first);
  const [tried, setTried] = useState(refused);
  const [busy, setBusy] = useState(false);
  const symbol = currency === 'JPY' ? '¥' : currency === 'KWD' ? 'KWD' : '£';
  const problems = Object.fromEntries(
    CEILING_KEYS.map((key) => [key, ceilingProblem(values[key], currency)]),
  ) as Record<CeilingKey, string | null>;
  const shown = (key: CeilingKey) => (tried ? problems[key] : null);
  const count = tried ? CEILING_KEYS.filter((key) => problems[key] != null).length : 0;
  const typed = Object.fromEntries(
    CEILING_KEYS.filter((key) => values[key].trim() !== '' && problems[key] == null).map((key) => [
      key,
      minorOf(values[key].replace(/^£/, '')),
    ]),
  ) as Partial<Record<CeilingKey, number>>;
  const said = categoryCeilingsLine(typed);

  function save(): void {
    if (busy) return;
    setTried(true);
    const wrong = CEILING_KEYS.find((key) => problems[key] != null);
    if (wrong != null) {
      document.getElementById(`ceil-${wrong}`)?.focus();
      return;
    }
    setBusy(true);
    window.setTimeout(() => onSaved(typed), BUSY_MS);
  }

  return (
    <BudgetDialog
      width={700}
      title={Object.keys(ceilings).length === 0 ? 'Set a ceiling' : 'Change the ceiling'}
      verb={busy ? W.saving : 'Save the ceiling'}
      locked={busy}
      onDismiss={onDismiss}
      onConfirm={save}
    >
      {count > 0 && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {fieldsWrong(count)}
        </p>
      )}
      <div className="bud-ceiling-whole">
        <CeilingField
          id="ceil-whole"
          label="Whole event"
          symbol={symbol}
          value={values.whole}
          help="Optional. 0 is allowed."
          error={shown('whole')}
          onChange={(value) => setValues((now) => ({ ...now, whole: value }))}
        />
      </div>
      <p className="bud-caps">Each category, optional</p>
      <div className="bud-ceiling-grid">
        {CEILING_KEYS.filter((key) => key !== 'whole').map((key) => (
          <CeilingField
            key={key}
            id={`ceil-${key}`}
            label={ceilingName(key)}
            symbol={symbol}
            value={values[key]}
            error={shown(key)}
            onChange={(value) => setValues((now) => ({ ...now, [key]: value }))}
          />
        ))}
      </div>
      {said != null && <p className="desk-note">{said}</p>}
      {currency !== CURRENCY && (
        <InfoLine>{`The examples are built at ${currency}’s minor unit, like ${ceilingExample(currency)}.`}</InfoLine>
      )}
    </BudgetDialog>
  );
}

function CeilingField({
  id,
  label,
  symbol,
  value,
  help,
  error,
  onChange,
}: {
  id: string;
  label: string;
  symbol: string;
  value: string;
  help?: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="desk-field bud-money">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <span className="bud-symbol" aria-hidden="true">
          {symbol}
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          aria-invalid={error != null}
          aria-describedby={
            [help == null ? null : `${id}-help`, error == null ? null : `${id}-error`]
              .filter(Boolean)
              .join(' ') || undefined
          }
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
    </div>
  );
}

const SCOPES = [
  { key: 'event', word: 'The whole event', line: 'Every cost without its own markup or price' },
  { key: 'category', word: 'A category', line: 'Overrides the event’s' },
  { key: 'cost', word: 'One cost', line: 'Overrides both, or set at cost' },
] as const;

function MarkupDialog({ first, onDismiss }: { first: string; onDismiss: () => void }) {
  const [scope, setScope] = useState<string>('event');
  const [typed, setTyped] = useState(
    { markup_negative: '−5', markup_cap: '1200', markup_decimals: '20.25' }[
      first as 'markup_cap'
    ] ?? '20',
  );
  const [tried, setTried] = useState(first !== 'markup');
  const field = useRef<HTMLInputElement>(null);
  const id = useId();
  const problem = tried ? markupProblem(typed) : null;

  return (
    <BudgetDialog
      title="Markup"
      verb={W.save}
      onDismiss={onDismiss}
      onConfirm={() => {
        setTried(true);
        if (markupProblem(typed) != null) return field.current?.focus();
        onDismiss();
      }}
    >
      <fieldset className="bud-bases">
        <legend className="desk-unseen">Markup for</legend>
        <ul className="desk-rows">
          {SCOPES.map((one) => (
            <li key={one.key}>
              <label className={scope === one.key ? 'desk-row is-picked' : 'desk-row'}>
                <input
                  type="radio"
                  className="desk-radio"
                  name={`${id}-scope`}
                  checked={scope === one.key}
                  onChange={() => setScope(one.key)}
                />
                <RowWords title={one.word} lines={[one.line]} />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <MoneyField
        label="Markup"
        symbol=""
        unit="%"
        value={typed}
        error={problem}
        inputRef={field}
        help="A share of cost: £1,000 at 25% is charged at £1,250."
        onChange={(value) => {
          setTyped(value);
        }}
      />
      <p className="desk-note">
        Margin is a share of the client price: 20% markup is a 16.7% margin.
      </p>
    </BudgetDialog>
  );
}

type DueNowState = 'owed' | 'marked' | 'paidElsewhere' | 'cancelled' | 'refused';

const REMINDED = ['p6', 'p7'];

function DueNowDialog({
  event,
  first,
  onClose,
}: {
  event: SampleEvent;
  first: string;
  onClose: () => void;
}) {
  const readOnly = first === 'due_read_only';
  const [rows, setRows] = useState<Record<string, DueNowState>>(() => {
    if (first === 'due_marked') return { p6: 'marked', p7: 'owed' };
    if (first === 'due_changed') return { p6: 'paidElsewhere', p7: 'cancelled' };
    if (first === 'due_refused') return { p6: 'owed', p7: 'refused' };
    if (first === 'due_done') return { p6: 'marked', p7: 'marked' };

    return { p6: 'owed', p7: 'owed' };
  });
  const done = first === 'due_done' || REMINDED.every((id) => rows[id] === 'marked');
  const payments = REMINDED.map((id) => PAYMENTS.find((one) => one.id === id)).filter(
    (one): one is Payment => one != null,
  );

  return (
    <BudgetDialog
      title="Due now"
      verb="Close"
      cancel={false}
      onDismiss={onClose}
      onConfirm={onClose}
    >
      {done ? (
        <>
          <p className="bud-due-done" role="status">
            Nothing left to pay from this reminder
          </p>
          <Link className="desk-text" to={budgetAt(undefined, { view: 'due' })}>
            {`Everything due on ${event.name}`}
          </Link>
        </>
      ) : (
        <>
          <p className="desk-line">From the reminder sent Nov 1 · 2 payments</p>
          {readOnly && <ReadOnlyLine />}
          <Rows label="Due now">
            {payments.map((payment) => {
              const now = rows[payment.id] ?? 'owed';
              const where = `${payment.what} · ${
                overdue(payment)
                  ? `Overdue since ${shortDay(payment.dueOn)}`
                  : W.due(shortDay(payment.dueOn))
              } · ${event.name}`;
              const said =
                now === 'paidElsewhere'
                  ? `${where} · Paid by Julien Moreau on Nov 2`
                  : now === 'cancelled'
                    ? `${where} · Cancelled`
                    : now === 'refused'
                      ? `${where} · This payment has been cancelled, so it cannot be marked paid.`
                      : where;

              return (
                <li key={payment.id}>
                  {now === 'marked' ? (
                    <div className="desk-row bud-row is-on" role="status">
                      <span className="bud-lead">
                        <Mark kind="yes" />
                      </span>
                      <RowWords
                        title={vendorName(payment.vendorId)}
                        lines={[`Marked paid · ${money(payment.amount)}`]}
                      />
                      <button
                        type="button"
                        className="desk-text"
                        onClick={() => setRows((was) => ({ ...was, [payment.id]: 'owed' }))}
                      >
                        <Glyph name="undo" size={16} weight={2.4} />
                        {W.undo}
                      </button>
                    </div>
                  ) : (
                    <>
                      <BudgetRow
                        title={vendorName(payment.vendorId)}
                        lines={[said]}
                        end={<Amount value={money(payment.amount)} />}
                      />
                      {now === 'owed' && !readOnly && (
                        <div className="bud-row-actions">
                          <TextAction
                            label="Paid"
                            onClick={() => setRows((was) => ({ ...was, [payment.id]: 'marked' }))}
                          />
                          <Link
                            className="desk-text"
                            to={budgetAt('paid_more', { vendor: payment.vendorId })}
                          >
                            Paid a different amount
                          </Link>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </Rows>
        </>
      )}
    </BudgetDialog>
  );
}
