import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Card, CardStep, Field } from '../components/SettingsParts.tsx';
import { BudgetDialog, BudgetRow, MoneyField, Rows } from './BudgetParts.tsx';
import { TODAY, type Payment, money, shortDay } from './budget.ts';
import { BUDGET_WORDS as BW } from './budgetWords.ts';
import {
  type Cancelling,
  type Changing,
  type MadeDraft,
  type MadeOpen,
  daysProblem,
  keptOf,
  madeProblems,
  reasonProblem,
  remindersStart,
} from './payments.ts';
import { PW } from './paymentsWords.ts';
import { BUSY_MS, DateField, TextField } from './QuoteForms.tsx';
import { type Quote } from './quotes.ts';
import { QW } from './quotesWords.ts';
import { type Viewer, settingsPath } from './settings.ts';
import { VW } from './vendorsWords.ts';
import './payments.css';

function focusFirstWrong(): void {
  window.setTimeout(
    () => document.querySelector<HTMLElement>('.desk-dialog [aria-invalid="true"]')?.focus(),
    0,
  );
}

function useBusy(): [boolean, (then: () => void) => void] {
  const [busy, setBusy] = useState(false);
  const pending = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(pending.current), []);

  return [
    busy,
    (then) => {
      setBusy(true);
      pending.current = window.setTimeout(() => {
        setBusy(false);
        then();
      }, BUSY_MS);
    },
  ];
}

/** sc-88's ring with a bar: a cancelled payment, never deleted. */
export function CancelledMark() {
  return (
    <span className="pay-cancelled" aria-hidden="true">
      <span />
    </span>
  );
}

/** Cancel payment, 540: why it is not owed, optional and kept in its history; Keep it at the left. */
export function CancelDialog({
  cancelling,
  payment,
  vendor,
  onCancelling,
  onClose,
  onSaved,
}: {
  cancelling: Cancelling;
  payment: Payment;
  vendor: string;
  onCancelling: (next: Cancelling) => void;
  onClose: () => void;
  onSaved: (why: string) => void;
}) {
  const id = useId();
  const first = useRef<HTMLInputElement>(null);
  const [busy, wait] = useBusy();

  const save = () => {
    if (busy) return;
    const problem = reasonProblem(cancelling.why);
    onCancelling({ ...cancelling, problem });
    if (problem != null) {
      focusFirstWrong();
      return;
    }
    wait(() => onSaved(cancelling.why));
  };

  return (
    <BudgetDialog
      title={PW.cancelPayment}
      verb={busy ? BW.saving : PW.cancelPayment}
      dismiss={PW.keepIt}
      on={!busy}
      first={first}
      onDismiss={onClose}
      onConfirm={save}
    >
      <div className="desk-fields">
        <p className="desk-line">
          {PW.cancelAbout(
            vendor,
            payment.what,
            money(payment.amount),
            BW.due(shortDay(payment.dueOn)),
          )}
        </p>
        <TextField
          id={`${id}-why`}
          label={PW.whyNotOwed}
          value={cancelling.why}
          error={cancelling.problem}
          optional
          help={PW.whyHelp}
          inputRef={first}
          onChange={(why) =>
            onCancelling({
              ...cancelling,
              why,
              problem: cancelling.problem == null ? null : reasonProblem(why),
            })
          }
        />
        <p className="pay-note">{PW.staysCancelled}</p>
      </div>
    </BudgetDialog>
  );
}

/** Add a payment already made, 540: scheduled and paid in one action, its Vendor starting on the page's vendor. */
export function MadeDialog({
  made,
  quotes,
  onMade,
  onClose,
  onSaved,
}: {
  made: MadeOpen;
  quotes: readonly Quote[];
  onMade: (next: MadeOpen) => void;
  onClose: () => void;
  onSaved: (draft: MadeDraft) => void;
}) {
  const id = useId();
  const first = useRef<HTMLSelectElement>(null);
  const [busy, wait] = useBusy();
  const { draft, problems } = made;
  const quoteOf = (vendorId: string) => quotes.find((one) => one.vendor.id === vendorId);
  const vendors = quotes
    .map((one) => one.vendor)
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const set = (change: Partial<MadeDraft>) => {
    const next = { ...draft, ...change };
    onMade({ draft: next, problems: keptOf(problems, madeProblems(next, quoteOf(next.vendorId))) });
  };
  const save = () => {
    if (busy) return;
    const found = madeProblems(draft, quoteOf(draft.vendorId));
    onMade({ draft, problems: found });
    if (Object.keys(found).length > 0) {
      focusFirstWrong();
      return;
    }
    wait(() => onSaved(draft));
  };

  return (
    <BudgetDialog
      title={PW.alreadyMade}
      verb={busy ? BW.saving : QW.add}
      on={!busy}
      first={first}
      onDismiss={onClose}
      onConfirm={save}
    >
      <div className="desk-fields">
        <div className="desk-field">
          <label htmlFor={`${id}-vendor`} className="desk-label">
            {QW.vendor}
          </label>
          <div className="desk-box">
            <select
              ref={first}
              id={`${id}-vendor`}
              className="pay-select"
              value={draft.vendorId}
              aria-describedby={`${id}-vendor-help`}
              onChange={(event) => set({ vendorId: event.target.value })}
            >
              {vendors.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.name}
                </option>
              ))}
            </select>
          </div>
          <p id={`${id}-vendor-help`} className="desk-help">
            {PW.onlyQuoted}
          </p>
        </div>
        <TextField
          id={`${id}-what`}
          label={PW.whatItWasFor}
          value={draft.what}
          error={problems.what ?? null}
          onChange={(what) => set({ what })}
        />
        <MoneyField
          label={QW.amountPaid}
          value={draft.amount}
          error={problems.amount ?? null}
          onChange={(amount) => set({ amount })}
        />
        <DateField
          id={`${id}-paid`}
          label={QW.datePaid}
          value={draft.paidOn}
          max={TODAY}
          error={problems.paidOn ?? null}
          onChange={(paidOn) => {
            if (paidOn <= TODAY) set({ paidOn });
          }}
        />
        <TextField
          id={`${id}-reference`}
          label={QW.reference}
          value={draft.reference}
          error={problems.reference ?? null}
          optional
          onChange={(reference) => set({ reference })}
        />
      </div>
    </BudgetDialog>
  );
}

/** sc-95's one setting, for owners and admins: the card says when reminders go; who hears and how are stated, not chosen. */
export function PaymentReminders({ viewer, state }: { viewer: Viewer; state: string }) {
  return viewer.manages ? <Reminders viewer={viewer} state={state} /> : <Refused viewer={viewer} />;
}

function Reminders({ viewer, state }: { viewer: Viewer; state: string }) {
  const [start] = useState(() => remindersStart(state));
  const [days, setDays] = useState(start.days);
  const [changing, setChanging] = useState<Changing | null>(start.changing);

  return (
    <div className="desk-page">
      <div className="desk-column">
        <Card>
          <div className="desk-said-lines">
            <h1 className="desk-says pay-says" tabIndex={-1}>
              {PW.paymentReminders}
            </h1>
            <p className="desk-on-card" aria-live="polite">
              {PW.whenReminded(days)}
            </p>
          </div>
          <CardStep
            label={PW.change}
            onClick={() => setChanging({ typed: String(days), problem: null })}
          />
        </Card>
        <Rows>
          <li>
            <BudgetRow title={PW.whoHears} lines={[PW.whoHearsLine]} />
          </li>
          <li>
            <BudgetRow
              title={PW.how}
              lines={[PW.howLine]}
              to={settingsPath('notifications', viewer)}
            />
          </li>
        </Rows>
      </div>
      {changing != null && (
        <DaysDialog
          changing={changing}
          onChanging={setChanging}
          onClose={() => setChanging(null)}
          onSaved={(next) => {
            setDays(next);
            setChanging(null);
          }}
        />
      )}
    </div>
  );
}

function DaysDialog({
  changing,
  onChanging,
  onClose,
  onSaved,
}: {
  changing: Changing;
  onChanging: (next: Changing) => void;
  onClose: () => void;
  onSaved: (days: number) => void;
}) {
  const first = useRef<HTMLInputElement>(null);
  const [busy, wait] = useBusy();

  const save = () => {
    if (busy) return;
    const problem = daysProblem(changing.typed);
    onChanging({ ...changing, problem });
    if (problem != null) {
      focusFirstWrong();
      return;
    }
    wait(() => onSaved(Number(changing.typed.trim())));
  };

  return (
    <BudgetDialog
      title={PW.paymentReminders}
      verb={busy ? BW.saving : BW.save}
      on={!busy}
      first={first}
      onDismiss={onClose}
      onConfirm={save}
    >
      <div className="desk-fields">
        <Field
          label={PW.daysField}
          value={changing.typed}
          inputMode="numeric"
          help={PW.daysHelp}
          error={changing.problem}
          inputRef={first}
          onChange={(typed) =>
            onChanging({ typed, problem: changing.problem == null ? null : daysProblem(typed) })
          }
        />
      </div>
    </BudgetDialog>
  );
}

function Refused({ viewer }: { viewer: Viewer }) {
  const { t } = useTranslation();

  return (
    <div className="desk-page">
      <div className="desk-column">
        <div className="pay-refused" role="alert">
          <h1 className="desk-title" tabIndex={-1}>
            {t('forbidden.title')}
          </h1>
          <Link className="desk-text" to={settingsPath('account', viewer)}>
            <Glyph name="back" size={16} weight={2.4} />
            {VW.backToSettings}
          </Link>
        </div>
      </div>
    </div>
  );
}
