import { type KeyboardEvent, type RefObject, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { RowWords, TextAction } from '../components/SettingsParts.tsx';
import {
  AlertInset,
  Amount,
  BudgetDialog,
  BudgetRow,
  MoneyField,
  Opened as OpenedBox,
  OpenedActions,
  Rows,
} from './BudgetParts.tsx';
import {
  COST_LINES,
  type Payment,
  amounts,
  lineState,
  longDay,
  money,
  moneyRange,
  shortDay,
} from './budget.ts';
import { BUDGET_WORDS as BW } from './budgetWords.ts';
import { Alert } from './EventParts.tsx';
import {
  type EventDays,
  SHAPES,
  CURRENCY_NAME,
  type ShapeRow,
  type Shaping,
  anyShapeProblem,
  keptOf,
  retyped,
  shapeLine,
  shapeRows,
  shapingOf,
  shapingProblems,
  sharesLine,
  sharesTyped,
  typedDifference,
  typedTerms,
} from './payments.ts';
import { PW } from './paymentsWords.ts';
import {
  type Amending,
  type Budget,
  type BudgetViewer,
  type MarkDraft,
  type Marking,
  type Opened,
  type PaymentDraft,
  type PaymentOpen,
  type Quote,
  type QuoteDraft,
  type QuoteField,
  type Refusal,
  TAKEN_LINE,
  TODAY,
  agreedElsewhere,
  anyToOffer,
  directoryAt,
  draftOfQuote,
  lineName,
  markProblems,
  offered,
  parsedAmount,
  paymentProblems,
  quoteProblems,
  quotedVendorOf,
  linesToSave,
} from './quotes.ts';
import { QW } from './quotesWords.ts';
import { type Vendor } from './vendors.ts';
import { CATEGORY_WORDS } from './vendorsWords.ts';

export const BUSY_MS = 900;

function focusFirstWrong(): void {
  window.setTimeout(
    () => document.querySelector<HTMLElement>('.desk-dialog [aria-invalid="true"]')?.focus(),
    0,
  );
}

function refusalWords(refusal: Refusal, budget: Budget): string {
  if (refusal === 'second_quote') return QW.duplicate;
  if (refusal === 'vendor_gone') return QW.vendorGone;
  const holder = budget.quotes.find((one) => one.lines.includes(TAKEN_LINE))?.vendor.name ?? '';

  return QW.lineTaken(lineName(TAKEN_LINE), holder);
}

const TITLES = {
  add: BW.addAQuote,
  revise: QW.reviseTheQuote,
  correct: QW.correctTheQuote,
} as const;
const VERBS = { add: QW.add, revise: QW.revise, correct: BW.save } as const;

/** Add (800, two columns), Revise or Correct (540): the vendor is chosen once, on Add; Revise changes the amount or the date; Correct the rest. */
export function QuoteDialog({
  opened,
  budget,
  vendors,
  current,
  viewer,
  onOpened,
  onList,
  onClose,
  onSaved,
}: {
  opened: Opened;
  budget: Budget;
  vendors: readonly Vendor[];
  current: Quote | null;
  viewer: BudgetViewer;
  onOpened: (next: Opened) => void;
  onList: (list: boolean) => void;
  onClose: () => void;
  onSaved: (budget: Budget, words: string) => void;
}) {
  const id = useId();
  const { form, draft, problems, refusal } = opened;
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const pending = useRef<number | undefined>(undefined);
  const vendorId = current?.vendor.id ?? draft.vendorId;
  const wrong = Object.keys(problems).length;

  useEffect(() => () => window.clearTimeout(pending.current), []);

  const set = (change: Partial<QuoteDraft>) => {
    const next = { ...draft, ...change };
    const now = quoteProblems(next, form, TODAY, current ?? undefined);
    onOpened({ ...opened, draft: next, problems: keptOf<QuoteField>(problems, now) });
  };
  const save = () => {
    if (busy) return;
    const found = quoteProblems(draft, form, TODAY, current ?? undefined);
    onOpened({ ...opened, problems: found, refusal: null, list: false });
    if (Object.keys(found).length > 0) {
      focusFirstWrong();
      return;
    }
    setBusy(true);
    pending.current = window.setTimeout(() => {
      setBusy(false);
      onSaved(...saved(budget, vendors, draft, form, current));
    }, BUSY_MS);
  };
  const switchTo = (next: 'revise' | 'correct') =>
    current != null &&
    onOpened({
      form: next,
      draft: draftOfQuote(current),
      problems: {},
      refusal: null,
      list: false,
    });

  const vendorField =
    form === 'add' ? (
      <VendorField
        id={`${id}-vendor`}
        inputRef={first}
        vendors={vendors}
        quoted={budget.quotes.map((one) => one.vendor.id)}
        draft={draft}
        open={opened.list}
        error={problems.vendor ?? null}
        viewer={viewer}
        onOpen={onList}
        onType={(typed) =>
          onOpened({ ...opened, draft: { ...draft, typed, vendorId: '' }, list: true })
        }
        onChoose={(vendor) => {
          const next = { ...draft, typed: vendor.name, vendorId: vendor.id };
          const kept = { ...problems };
          delete kept.vendor;
          onOpened({ ...opened, draft: next, problems: kept, list: false });
        }}
      />
    ) : (
      <Fixed label={QW.vendor} value={current?.vendor.name ?? ''} />
    );
  const covers = (
    <TextField
      id={`${id}-covers`}
      label={QW.whatItCovers}
      value={draft.covers}
      error={problems.covers ?? null}
      lines={3}
      onChange={(next) => set({ covers: next })}
    />
  );
  const number = (
    <TextField
      id={`${id}-number`}
      label={QW.quoteNumber}
      value={draft.number}
      error={problems.number ?? null}
      optional
      help={QW.numberHelp}
      onChange={(next) => set({ number: next })}
    />
  );
  const amount = (
    <MoneyField
      label={QW.amount}
      value={draft.amount}
      help={QW.inPounds}
      error={problems.amount ?? null}
      {...(form === 'revise' ? { inputRef: first } : {})}
      onChange={(next) => set({ amount: next })}
    />
  );
  const quotedOn = (
    <DateField
      id={`${id}-quoted`}
      label={QW.dateQuoted}
      value={draft.quotedOn}
      max={TODAY}
      error={problems.quotedOn ?? null}
      onChange={(next) => set({ quotedOn: next })}
    />
  );
  const lines = (
    <LinesField
      budget={budget}
      vendorId={vendorId}
      ticked={draft.lines}
      onTick={(next) => set({ lines: next })}
    />
  );

  return (
    <BudgetDialog
      width={form === 'add' ? 800 : 540}
      title={TITLES[form]}
      verb={busy ? BW.saving : VERBS[form]}
      on={!busy}
      first={first}
      onDismiss={onClose}
      onConfirm={save}
    >
      <div className="desk-fields">
        {refusal != null && <AlertInset>{refusalWords(refusal, budget)}</AlertInset>}
        {form === 'add' && wrong > 1 && <Alert>{BW.fieldsWrong(wrong)}</Alert>}
        {form === 'revise' && <p className="desk-note">{QW.reviseIntro}</p>}
        {form === 'correct' && (
          <>
            <p className="desk-note">{QW.correctIntro}</p>
            <TextAction label={QW.reviseInstead} onClick={() => switchTo('revise')} />
          </>
        )}
        {form === 'add' ? (
          <div className="qt-two">
            <div className="desk-fields">
              {vendorField}
              {covers}
              {number}
            </div>
            <div className="desk-fields">
              {amount}
              {quotedOn}
              {lines}
            </div>
          </div>
        ) : form === 'revise' ? (
          <>
            {vendorField}
            {amount}
            {quotedOn}
            {problems.amount != null && problems.amount === problems.quotedOn && (
              <TextAction label={QW.correctInstead} onClick={() => switchTo('correct')} />
            )}
          </>
        ) : (
          <>
            {vendorField}
            {covers}
            {current != null && (
              <>
                <Fixed label={QW.amount} value={money(current.amount)} />
                <Fixed label={QW.dateQuoted} value={longDay(current.quotedOn)} />
              </>
            )}
            {number}
            {lines}
          </>
        )}
      </div>
    </BudgetDialog>
  );
}

function saved(
  budget: Budget,
  vendors: readonly Vendor[],
  draft: QuoteDraft,
  form: 'add' | 'revise' | 'correct',
  current: Quote | null,
): [Budget, string] {
  const amount = parsedAmount(draft.amount) ?? 0;

  if (form === 'add' || current == null) {
    const vendor = vendors.find((one) => one.id === draft.vendorId);
    if (vendor == null) return [budget, ''];
    const quote: Quote = {
      vendor: quotedVendorOf(vendor),
      covers: draft.covers.trim(),
      amount,
      quotedOn: draft.quotedOn,
      number: draft.number.trim(),
      lines: linesToSave(budget, vendor.id, draft.lines),
      earlier: [],
    };

    return [
      { ...budget, quotes: [...budget.quotes, quote] },
      QW.quoteAdded(vendor.name, money(amount), longDay(draft.quotedOn)),
    ];
  }

  const replace = (next: Quote): Budget => ({
    ...budget,
    quotes: budget.quotes.map((one) => (one.vendor.id === current.vendor.id ? next : one)),
  });

  if (form === 'revise')
    return [
      replace({
        ...current,
        amount,
        quotedOn: draft.quotedOn,
        earlier: [
          { amount: current.amount, quotedOn: current.quotedOn, number: current.number },
          ...current.earlier,
        ],
      }),
      QW.quoteRevised(current.vendor.name, money(amount), longDay(draft.quotedOn)),
    ];

  const number = draft.number.trim();

  return [
    replace({
      ...current,
      covers: draft.covers.trim(),
      number,
      lines: linesToSave(budget, current.vendor.id, draft.lines),
    }),
    QW.quoteCorrected(current.vendor.name, number),
  ];
}

/** The organisation's vendors not archived, narrowing as a name is typed: each its name, category and contact name, nothing else. */
function VendorField({
  id,
  inputRef,
  vendors,
  quoted,
  draft,
  open,
  error,
  viewer,
  onOpen,
  onType,
  onChoose,
}: {
  id: string;
  inputRef: RefObject<HTMLInputElement | null>;
  vendors: readonly Vendor[];
  quoted: readonly string[];
  draft: QuoteDraft;
  open: boolean;
  error: string | null;
  viewer: BudgetViewer;
  onOpen: (open: boolean) => void;
  onType: (typed: string) => void;
  onChoose: (vendor: Vendor) => void;
}) {
  const [active, setActive] = useState(0);
  const blurred = useRef<number | undefined>(undefined);
  const typed = draft.vendorId === '' ? draft.typed : '';
  const rows = offered(vendors, typed);
  const none = !anyToOffer(vendors);
  const showList = open && !none && rows.length > 0;
  const told = [error == null ? null : `${id}-error`, `${id}-status`].filter(Boolean).join(' ');
  const choose = (vendor: Vendor | undefined) => {
    if (vendor == null || quoted.includes(vendor.id)) return;
    onChoose(vendor);
  };
  useEffect(() => () => window.clearTimeout(blurred.current), []);

  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) onOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((now) => Math.min(Math.max(0, now + step), Math.max(0, rows.length - 1)));
    } else if (event.key === 'Enter' && showList) {
      event.preventDefault();
      choose(rows[active]);
    } else if (event.key === 'Escape' && showList) {
      event.preventDefault();
      event.stopPropagation();
      onOpen(false);
    }
  };

  return (
    <div className="desk-field qt-vendor">
      <label htmlFor={id} className="desk-label">
        {QW.vendor}
      </label>
      <div className={error == null ? 'desk-box qt-combo' : 'desk-box qt-combo is-wrong'}>
        <Glyph name="search" size={18} weight={2.2} />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-activedescendant={showList ? `${id}-option-${active}` : undefined}
          aria-invalid={error != null}
          aria-describedby={told}
          autoComplete="off"
          spellCheck={false}
          placeholder={QW.typeAName}
          value={draft.typed}
          onFocus={() => {
            window.clearTimeout(blurred.current);
            onOpen(draft.vendorId === '');
          }}
          onBlur={() => {
            blurred.current = window.setTimeout(() => onOpen(false), 120);
          }}
          onChange={(event) => {
            setActive(0);
            onType(event.target.value);
          }}
          onKeyDown={keys}
        />
      </div>
      {showList && (
        <ul id={`${id}-list`} role="listbox" aria-label={QW.vendors} className="qt-options">
          {rows.map((vendor, index) => {
            const taken = quoted.includes(vendor.id);

            return (
              <li
                key={vendor.id}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === active}
                aria-disabled={taken}
                className={['qt-option', index === active && 'is-active', taken && 'is-taken']
                  .filter(Boolean)
                  .join(' ')}
                onPointerDown={(pointer) => pointer.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(vendor)}
                onKeyDown={(key) => {
                  if (key.key === 'Enter') choose(vendor);
                }}
              >
                <RowWords
                  title={vendor.name}
                  lines={[
                    QW.vendorLine(CATEGORY_WORDS[vendor.category], vendor.contact),
                    ...(taken ? [QW.alreadyQuoted] : []),
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}
      <div id={`${id}-status`} role="status" className="qt-vendor-status">
        {(none || (open && rows.length === 0 && typed.trim() !== '')) && (
          <>
            <p className="desk-line is-ink">{none ? QW.noVendors : QW.noVendorMatches(typed)}</p>
            {viewer.readsVendors ? (
              <Link className="desk-text" to={directoryAt(null, viewer.key)}>
                {QW.addOnVendors}
              </Link>
            ) : (
              <p className="desk-line">{QW.askToAdd}</p>
            )}
          </>
        )}
      </div>
      <Problem id={`${id}-error`} line={error} />
    </div>
  );
}

function lineLine(id: string, elsewhere: Quote | null): string {
  if (elsewhere != null) return QW.agreedIn(elsewhere.vendor.name);
  const line = COST_LINES.find((one) => one.id === id);
  if (line == null) return '';
  const category = CATEGORY_WORDS[line.category];
  if (lineState(line) === 'notPriced') return QW.notPricedLine(category);
  const each = amounts(line);

  return QW.priced(moneyRange(each.settled, each.ifAll), category);
}

/** sc-83's lines: a line agreed in another vendor's quote shows that vendor and cannot be ticked. */
function LinesField({
  budget,
  vendorId,
  ticked,
  onTick,
}: {
  budget: Budget;
  vendorId: string;
  ticked: readonly string[];
  onTick: (lines: string[]) => void;
}) {
  const id = useId();

  return (
    <div className="desk-field qt-lines" role="group" aria-labelledby={id}>
      <div className="qt-label-row">
        <span id={id} className="desk-label">
          {QW.linesItAgrees}
        </span>
        <span className="qt-optional">{QW.optional}</span>
      </div>
      <ul className="desk-rows">
        {COST_LINES.map((line) => {
          const elsewhere = agreedElsewhere(budget, line.id, vendorId);

          return (
            <li key={line.id}>
              <label
                className={elsewhere == null ? 'desk-row qt-line' : 'desk-row qt-line is-taken'}
              >
                <input
                  type="checkbox"
                  className="qt-check"
                  checked={elsewhere == null && ticked.includes(line.id)}
                  disabled={elsewhere != null}
                  onChange={() =>
                    onTick(
                      ticked.includes(line.id)
                        ? ticked.filter((one) => one !== line.id)
                        : [...ticked, line.id],
                    )
                  }
                />
                <RowWords title={line.name} lines={[lineLine(line.id, elsewhere)]} />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Add a payment, 700: what it is for across, then the amount and the date due side by side. */
export function PaymentDialog({
  opened,
  quote,
  shaping = null,
  days,
  onOpened,
  onShaping,
  onClose,
  onSaved,
  onShaped,
}: {
  opened: PaymentOpen;
  quote: Quote;
  shaping?: Shaping | null;
  days?: EventDays;
  onOpened: (next: PaymentOpen) => void;
  onShaping?: (next: Shaping) => void;
  onClose: () => void;
  onSaved: (draft: PaymentDraft) => void;
  onShaped?: (rows: readonly ShapeRow[]) => void;
}) {
  const id = useId();
  const { draft, problems } = opened;
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const picked = useRef<HTMLInputElement>(null);
  const pending = useRef<number | undefined>(undefined);
  const shaped = shaping != null && shaping.shape !== 'rows';
  const rows = shaped && days != null ? shapeRows(typedTerms(shaping), quote, days) : [];
  const short = shaped && sharesTyped(shaping) ? sharesLine(rows, quote.amount) : null;
  const verb = shaped ? PW.saveShapes(shaping.terms.length) : QW.add;

  useEffect(() => () => window.clearTimeout(pending.current), []);

  const set = (change: Partial<PaymentDraft>) => {
    const next = { ...draft, ...change };
    onOpened({
      draft: next,
      problems: keptOf(problems, paymentProblems(next, quote, longDay)),
    });
  };
  const save = () => {
    if (busy) return;
    if (shaped) {
      const found = shapingProblems(shaping);
      onShaping?.({ ...shaping, problems: found });
      if (anyShapeProblem(found)) {
        focusFirstWrong();
        return;
      }
      setBusy(true);
      pending.current = window.setTimeout(() => {
        setBusy(false);
        onShaped?.(rows);
      }, BUSY_MS);
      return;
    }
    const found = paymentProblems(draft, quote, longDay);
    onOpened({ draft, problems: found });
    if (Object.keys(found).length > 0) {
      focusFirstWrong();
      return;
    }
    setBusy(true);
    pending.current = window.setTimeout(() => {
      setBusy(false);
      onSaved(draft);
    }, BUSY_MS);
  };

  return (
    <BudgetDialog
      width={700}
      title={QW.addAPayment}
      verb={busy ? BW.saving : verb}
      on={!busy}
      first={shaping == null ? first : picked}
      onDismiss={onClose}
      onConfirm={save}
    >
      <div className="desk-fields">
        {shaping?.raced === true && <AlertInset>{PW.raced}</AlertInset>}
        {shaping?.raced !== true && shaping?.failed === true && (
          <AlertInset>{PW.shapeFailed(verb)}</AlertInset>
        )}
        {shaping != null && (
          <fieldset className="pay-shapes">
            <legend className="pay-legend">{PW.howItIsPaid}</legend>
            <ul className="desk-rows bud-rows">
              {SHAPES.map((shape) => (
                <li key={shape}>
                  <label
                    className={
                      shape === shaping.shape
                        ? 'desk-row pay-shape is-chosen'
                        : 'desk-row pay-shape'
                    }
                  >
                    <input
                      ref={shape === shaping.shape ? picked : undefined}
                      type="radio"
                      className="desk-radio"
                      name={`${id}-shape`}
                      checked={shape === shaping.shape}
                      onChange={() => onShaping?.(shapingOf(shape, shaping.raced))}
                    />
                    <RowWords title={PW.shapes[shape]} />
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        {shaped ? (
          <>
            <Rows>
              {rows.map((row, index) => {
                const typed = shaping.typed[index];
                const problems = shaping.problems[index] ?? {};
                const at = `${id}-row-${index}`;

                return (
                  <li key={at} className="pay-shape-row">
                    <BudgetRow
                      title={row.what === '' ? PW.noDescription : row.what}
                      lines={[shapeLine(row)]}
                      end={<Amount value={money(row.amount)} />}
                    />
                    {typed != null && (
                      <div className="desk-fields">
                        <TextField
                          id={`${at}-what`}
                          label={QW.whatFor}
                          value={typed.what}
                          error={problems.what ?? null}
                          onChange={(what) => onShaping?.(retyped(shaping, index, { what }))}
                        />
                        <div className="qt-two">
                          <TextField
                            id={`${at}-share`}
                            label={PW.shareField}
                            value={typed.share}
                            help={PW.shareHelp}
                            error={problems.share ?? null}
                            onChange={(share) => onShaping?.(retyped(shaping, index, { share }))}
                          />
                          {row.from !== 'quoted' && (
                            <TextField
                              id={`${at}-days`}
                              label={row.from === 'before' ? PW.daysBeforeField : PW.daysAfterField}
                              value={typed.days}
                              help={PW.shapeDaysHelp}
                              error={problems.days ?? null}
                              onChange={(days) => onShaping?.(retyped(shaping, index, { days }))}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </Rows>
            {short == null ? (
              <p className="pay-note">{PW.eachRowSaved}</p>
            ) : (
              <p className="pay-note is-amber">{short}</p>
            )}
          </>
        ) : (
          <>
            <Fixed label={QW.vendor} value={quote.vendor.name} />
            <PaymentFields id={id} draft={draft} problems={problems} first={first} onSet={set} />
          </>
        )}
      </div>
    </BudgetDialog>
  );
}

function PaymentFields({
  id,
  draft,
  problems,
  first,
  stacked = false,
  onSet,
}: {
  id: string;
  draft: PaymentDraft;
  problems: Partial<Record<keyof PaymentDraft, string>>;
  first: RefObject<HTMLInputElement | null>;
  stacked?: boolean;
  onSet: (change: Partial<PaymentDraft>) => void;
}) {
  return (
    <>
      <TextField
        id={`${id}-what`}
        label={QW.whatFor}
        value={draft.what}
        error={problems.what ?? null}
        inputRef={first}
        help={QW.whatForHelp}
        onChange={(what) => onSet({ what })}
      />
      <div className={stacked ? 'desk-fields' : 'qt-two'}>
        <MoneyField
          label={QW.amount}
          value={draft.amount}
          help={QW.inPounds}
          error={problems.amount ?? null}
          onChange={(amount) => onSet({ amount })}
        />
        <DateField
          id={`${id}-due`}
          label={QW.dateDue}
          value={draft.dueOn}
          error={problems.dueOn ?? null}
          onChange={(dueOn) => onSet({ dueOn })}
        />
      </div>
    </>
  );
}

/** Change, opened in place under its row: focus goes to the first field; Enter saves, Escape cancels. */
export function AmendInPlace({
  amending,
  quote,
  onAmending,
  onCancel,
  onSaved,
}: {
  amending: Amending;
  quote: Quote;
  onAmending: (next: Amending) => void;
  onCancel: () => void;
  onSaved: (draft: PaymentDraft) => void;
}) {
  const id = useId();
  const { draft, problems } = amending;
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const pending = useRef<number | undefined>(undefined);

  useEffect(() => {
    first.current?.focus();

    return () => window.clearTimeout(pending.current);
  }, []);

  const set = (change: Partial<PaymentDraft>) => {
    const next = { ...draft, ...change };
    onAmending({
      ...amending,
      draft: next,
      problems: keptOf(problems, paymentProblems(next, quote, longDay)),
    });
  };
  const save = () => {
    if (busy) return;
    const found = paymentProblems(draft, quote, longDay);
    onAmending({ ...amending, problems: found });
    if (Object.keys(found).length > 0) {
      window.setTimeout(
        () => document.querySelector<HTMLElement>('.bud-opened [aria-invalid="true"]')?.focus(),
        0,
      );
      return;
    }
    setBusy(true);
    pending.current = window.setTimeout(() => {
      setBusy(false);
      onSaved(draft);
    }, BUSY_MS);
  };

  const keys = useRef({ save, onCancel });

  useEffect(() => {
    keys.current = { save, onCancel };
  });

  useEffect(() => {
    const box = area.current;
    const press = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        keys.current.onCancel();
      } else if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        keys.current.save();
      }
    };
    box?.addEventListener('keydown', press);

    return () => box?.removeEventListener('keydown', press);
  }, []);

  return (
    <div ref={area}>
      <OpenedBox>
        <PaymentFields
          id={id}
          draft={draft}
          problems={problems}
          first={first}
          stacked
          onSet={set}
        />
        <OpenedActions busy={busy} onCancel={onCancel} onSave={save} />
      </OpenedBox>
    </div>
  );
}

/** sc-88's form at its basic path, 540: what is being paid, the amount scheduled, then the amount, the date and a reference. */
export function MarkPaidDialog({
  marking,
  payment,
  vendor,
  event,
  onMarking,
  onClose,
  onSaved,
}: {
  marking: Marking;
  payment: Payment;
  vendor: string;
  event: string;
  onMarking: (next: Marking) => void;
  onClose: () => void;
  onSaved: (draft: MarkDraft) => void;
}) {
  const id = useId();
  const { draft, problems, refused } = marking;
  const [busy, setBusy] = useState(false);
  const [told, setTold] = useState('');
  const first = useRef<HTMLInputElement>(null);
  const pending = useRef<number | undefined>(undefined);
  const difference = typedDifference(payment, draft.amount);

  useEffect(() => () => window.clearTimeout(pending.current), []);

  const set = (change: Partial<MarkDraft>) => {
    const next = { ...draft, ...change };
    onMarking({ ...marking, draft: next, problems: keptOf(problems, markProblems(next, payment)) });
  };
  const save = () => {
    if (busy) return;
    const found = markProblems(draft, payment);
    const wrong = Object.keys(found).length;
    onMarking({ ...marking, problems: found });
    setTold(wrong === 0 ? '' : wrong === 1 ? BW.oneFieldWrong : BW.fieldsWrong(wrong));
    if (wrong > 0) {
      focusFirstWrong();
      return;
    }
    setBusy(true);
    pending.current = window.setTimeout(() => {
      setBusy(false);
      onSaved(draft);
    }, BUSY_MS);
  };

  const about = (
    <>
      <p className="desk-line">{QW.markPaidAbout(vendor, payment.what, event)}</p>
      <Rows>
        <li>
          <BudgetRow
            title={QW.scheduled}
            lines={[BW.due(shortDay(payment.dueOn))]}
            end={<Amount value={money(payment.amount)} />}
          />
        </li>
      </Rows>
    </>
  );

  if (refused != null)
    return (
      <BudgetDialog
        title={BW.markPaid}
        verb={PW.close}
        cancel={false}
        onDismiss={onClose}
        onConfirm={onClose}
      >
        <div className="desk-fields">
          {about}
          <AlertInset>
            {refused === 'paid'
              ? PW.alreadyPaid(payment.paid?.by ?? '')
              : refused === 'currency'
                ? PW.wrongCurrency(CURRENCY_NAME)
                : refused === 'plan'
                  ? PW.noEntitlement
                  : PW.alreadyCancelled}
          </AlertInset>
        </div>
      </BudgetDialog>
    );

  return (
    <BudgetDialog
      title={BW.markPaid}
      verb={busy ? BW.saving : BW.markPaid}
      on={!busy}
      first={first}
      onDismiss={onClose}
      onConfirm={save}
    >
      <div className="desk-fields pay-mark">
        {about}
        <MoneyField
          label={QW.amountPaid}
          value={draft.amount}
          error={problems.amount ?? null}
          inputRef={first}
          {...(difference == null ? {} : { help: difference })}
          onChange={(amount) => set({ amount })}
        />
        <DateField
          id={`${id}-paid`}
          label={QW.datePaid}
          value={draft.paidOn}
          max={TODAY}
          help={QW.datePaidHelp}
          error={problems.paidOn ?? null}
          onChange={(paidOn) => set({ paidOn })}
        />
        <TextField
          id={`${id}-reference`}
          label={QW.reference}
          value={draft.reference}
          error={problems.reference ?? null}
          optional
          onChange={(reference) => set({ reference })}
        />
        <p className="visually-hidden" role="status">
          {told}
        </p>
      </div>
    </BudgetDialog>
  );
}

function Fixed({ label, value }: { label: string; value: string }) {
  return (
    <div className="desk-field">
      <span className="desk-label">{label}</span>
      <p className="desk-line is-ink qt-fixed">{value}</p>
    </div>
  );
}

function Problem({ id, line }: { id: string; line: string | null | undefined }) {
  return line == null ? null : (
    <p id={id} className="desk-error">
      <Glyph name="alert" size={15} weight={2.2} />
      {line}
    </p>
  );
}

function described(id: string, helped: boolean, error: string | null): string | undefined {
  const told = [helped ? `${id}-help` : null, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return told === '' ? undefined : told;
}

function Label({ id, label, optional }: { id: string; label: string; optional: boolean }) {
  return optional ? (
    <div className="qt-label-row">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <span className="qt-optional">{QW.optional}</span>
    </div>
  ) : (
    <label htmlFor={id} className="desk-label">
      {label}
    </label>
  );
}

export function TextField({
  id,
  label,
  value,
  error,
  optional = false,
  help,
  lines,
  inputRef,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error: string | null;
  optional?: boolean;
  help?: string;
  lines?: number;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
}) {
  const common = {
    id,
    value,
    spellCheck: false,
    'aria-invalid': error != null,
    'aria-describedby': described(id, help != null, error),
  };

  return (
    <div className="desk-field">
      <Label id={id} label={label} optional={optional} />
      <div
        className={['desk-box', lines != null && 'qt-area', error != null && 'is-wrong']
          .filter(Boolean)
          .join(' ')}
      >
        {lines == null ? (
          <input
            ref={inputRef}
            type="text"
            {...common}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <textarea rows={lines} {...common} onChange={(event) => onChange(event.target.value)} />
        )}
      </div>
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
      <Problem id={`${id}-error`} line={error} />
    </div>
  );
}

export function DateField({
  id,
  label,
  value,
  min,
  max,
  help,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  help?: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="desk-field">
      <Label id={id} label={label} optional={false} />
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={id}
          type="date"
          value={value}
          min={min}
          max={max}
          aria-invalid={error != null}
          aria-describedby={described(id, help != null, error)}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
      <Problem id={`${id}-error`} line={error} />
    </div>
  );
}
