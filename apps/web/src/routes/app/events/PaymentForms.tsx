import {
  ApiError,
  type EventQuote,
  type EventQuotes,
  type ScheduledPayment,
} from '@soirely/api-client';
import { moneyLanguage } from '@soirely/domain';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Dialog } from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { currencySign, minorMoney } from './budgetArea.ts';
import { AlertInset, DateField, MoneyField, TextField } from './QuoteForms.tsx';
import { Amount, BudgetRow, Rows } from './QuoteParts.tsx';
import {
  type MadeDraft,
  type MadeProblems,
  type MarkDraft,
  type MarkProblems,
  draftToMark,
  focusFirstWrong,
  keptOf,
  longDay,
  madeProblems,
  markProblems,
  paidDifference,
  paidRefusedAt,
  reasonProblem,
  refusalWords,
  sentAmount,
  shortDay,
  todayIn,
} from './quotesArea.ts';

type Refused = 'paid' | 'cancelled' | 'currency' | 'plan';

/** A refusal that no field can fix: the form gives way to it, with only Close. */
function refusedOf(error: unknown): Refused | null {
  if (!(error instanceof ApiError)) return null;
  if (error.is('payment_already_paid')) return 'paid';
  if (error.is('payment_cancelled')) return 'cancelled';
  if (error.is('plan_required')) return 'plan';
  if (error.fieldErrors()['currency'] != null) return 'currency';

  return null;
}

/** Mark paid, 540: the amount scheduled and today to start, either corrected; a different amount says by how much. */
export function MarkPaidDialog({
  eventId,
  eventName,
  quote,
  quotes,
  payment,
  onClose,
  onSaved,
}: {
  eventId: string;
  eventName: string;
  quote: EventQuote;
  quotes: EventQuotes;
  payment: ScheduledPayment;
  onClose: () => void;
  onSaved: (words: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const locale = dateLocale();
  const language = moneyLanguage(i18n.language);
  const { currency, timeZone } = quotes;
  const today = todayIn(timeZone);
  const at = { language, currency, today };
  const [draft, setDraft] = useState<MarkDraft>(() =>
    draftToMark(payment, language, currency, today),
  );
  const [problems, setProblems] = useState<MarkProblems>({});
  const [refused, setRefused] = useState<{ kind: Refused; words: string } | null>(null);
  const [top, setTop] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [told, setTold] = useState('');
  const first = useRef<HTMLInputElement>(null);
  const money = (amount: string) => minorMoney(amount, currency, locale);
  const typed = sentAmount(draft.amount, language, currency);
  const difference =
    typed == null ? null : paidDifference(t, payment.amount, typed, currency, locale);

  const set = (change: Partial<MarkDraft>) => {
    const next = { ...draft, ...change };
    setDraft(next);
    setProblems(keptOf(problems, markProblems(t, next, at)));
  };

  async function save(): Promise<void> {
    if (busy) return;
    const found = markProblems(t, draft, at);
    const wrong = Object.keys(found).length;
    setProblems(found);
    setTop(null);
    setTold(wrong === 0 ? '' : t('budget.form.fieldsWrong', { count: wrong }));
    if (wrong > 0) {
      focusFirstWrong('.desk-dialog');
      return;
    }
    const amount = typed ?? '';
    setBusy(true);
    try {
      await api.markPaid(eventId, payment.id, {
        amount,
        currency,
        paidOn: draft.paidOn,
        reference: draft.reference.trim(),
      });
    } catch (error) {
      setBusy(false);
      const kind = refusedOf(error);
      if (kind != null) {
        setRefused({ kind, words: refusedWords(kind, error) });
        return;
      }
      const at = paidRefusedAt(error instanceof ApiError ? error.fieldErrors() : {});
      if (Object.keys(at.fields).length === 0) {
        setTop(at.top ?? refusalWords(error, t('budget.form.failed')));
        return;
      }
      setProblems(at.fields);
      setTop(at.top);
      focusFirstWrong('.desk-dialog');
      return;
    }
    onSaved(t('quotes.markedPaid', { amount: money(amount), day: longDay(draft.paidOn, locale) }));
  }

  function refusedWords(kind: Refused, error: unknown): string {
    switch (kind) {
      case 'paid': {
        const by = payment.paid?.by?.name;
        const detail = error instanceof ApiError ? error.problem.detail : null;

        return (
          detail ??
          (by == null ? t('quotes.alreadyPaidNoName') : t('quotes.alreadyPaid', { name: by }))
        );
      }
      case 'cancelled':
        return t('quotes.alreadyCancelled');
      case 'currency':
        return t('quotes.wrongCurrency', {
          currency:
            new Intl.DisplayNames([i18n.language], { type: 'currency' }).of(currency) ?? currency,
        });
      case 'plan':
        return t('quotes.noEntitlement');
    }
  }

  const about = (
    <>
      <p className="desk-line">
        {t('quotes.markPaidAbout', {
          vendor: quote.vendor.name,
          what: payment.description,
          event: eventName,
        })}
      </p>
      <Rows>
        <li>
          <BudgetRow
            title={t('quotes.scheduled')}
            lines={[t('quotes.due', { day: shortDay(payment.dueOn, locale) })]}
            end={<Amount value={money(payment.amount)} />}
          />
        </li>
      </Rows>
    </>
  );

  if (refused != null)
    return (
      <Dialog
        title={t('quotes.markPaid')}
        verb={t('quotes.close')}
        cancel={false}
        onDismiss={onClose}
        onConfirm={onClose}
      >
        <div className="desk-fields">
          {about}
          <AlertInset>{refused.words}</AlertInset>
        </div>
      </Dialog>
    );

  return (
    <Dialog
      title={t('quotes.markPaid')}
      verb={busy ? t('budget.saving') : t('quotes.markPaid')}
      on={!busy}
      locked={busy}
      first={first}
      onDismiss={onClose}
      onConfirm={() => void save()}
    >
      <div className="desk-fields pay-mark">
        {top != null && <AlertInset>{top}</AlertInset>}
        {about}
        <MoneyField
          label={t('quotes.amountPaid')}
          value={draft.amount}
          sign={currencySign(currency, locale)}
          help={
            difference == null
              ? t('quotes.inCurrency', { currency })
              : t('quotes.differenceStays', { difference })
          }
          error={problems.amount ?? null}
          inputRef={first}
          onChange={(amount) => set({ amount })}
        />
        <DateField
          id={`${id}-paid`}
          label={t('quotes.datePaid')}
          value={draft.paidOn}
          max={today}
          help={t('quotes.datePaidHelp')}
          error={problems.paidOn ?? null}
          onChange={(paidOn) => set({ paidOn })}
        />
        <TextField
          id={`${id}-reference`}
          label={t('quotes.reference')}
          value={draft.reference}
          error={problems.reference ?? null}
          optional
          onChange={(reference) => set({ reference })}
        />
        <p className="visually-hidden" role="status">
          {told}
        </p>
      </div>
    </Dialog>
  );
}

/** Cancel payment, 540: why it is not owed, optional and kept in its history; Keep it at the left. */
export function CancelDialog({
  eventId,
  quote,
  quotes,
  payment,
  onClose,
  onSaved,
}: {
  eventId: string;
  quote: EventQuote;
  quotes: EventQuotes;
  payment: ScheduledPayment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const locale = dateLocale();
  const [why, setWhy] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [top, setTop] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  async function save(): Promise<void> {
    if (busy) return;
    const found = reasonProblem(t, why);
    setProblem(found);
    setTop(null);
    if (found != null) {
      focusFirstWrong('.desk-dialog');
      return;
    }
    setBusy(true);
    try {
      await api.cancelPayment(eventId, payment.id, why.trim());
    } catch (error) {
      setBusy(false);
      const reason = error instanceof ApiError ? error.fieldErrors()['reason'] : undefined;
      if (reason != null) {
        setProblem(reason);
        focusFirstWrong('.desk-dialog');
        return;
      }
      setTop(refusalWords(error, t('budget.form.failed')));
      return;
    }
    onSaved();
  }

  return (
    <Dialog
      title={t('quotes.cancelPayment')}
      verb={busy ? t('budget.saving') : t('quotes.cancelPayment')}
      dismiss={t('quotes.keepIt')}
      on={!busy}
      locked={busy}
      first={first}
      onDismiss={onClose}
      onConfirm={() => void save()}
    >
      <div className="desk-fields">
        {top != null && <AlertInset>{top}</AlertInset>}
        <p className="desk-line">
          {t('quotes.cancelAbout', {
            vendor: quote.vendor.name,
            what: payment.description,
            amount: minorMoney(payment.amount, quotes.currency, locale),
            due: t('quotes.due', { day: shortDay(payment.dueOn, locale) }),
          })}
        </p>
        <TextField
          id={`${id}-why`}
          label={t('quotes.whyNotOwed')}
          value={why}
          error={problem}
          optional
          help={t('quotes.whyHelp')}
          inputRef={first}
          onChange={(next) => {
            setWhy(next);
            if (problem != null) setProblem(reasonProblem(t, next));
          }}
        />
        <p className="pay-note">{t('quotes.staysCancelled')}</p>
      </div>
    </Dialog>
  );
}

/** Add a payment already made, 540: scheduled and paid in one action, its Vendor starting on the page's vendor. */
export function MadeDialog({
  eventId,
  quote,
  quotes,
  onClose,
  onSaved,
}: {
  eventId: string;
  quote: EventQuote;
  quotes: EventQuotes;
  onClose: () => void;
  onSaved: (made: { quoteId: string; paymentId: string; words: string }) => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const locale = dateLocale();
  const language = moneyLanguage(i18n.language);
  const { currency, timeZone } = quotes;
  const today = todayIn(timeZone);
  const at = { language, currency, today };
  const [draft, setDraft] = useState<MadeDraft>({
    quoteId: quote.id,
    description: '',
    amount: '',
    paidOn: today,
    reference: '',
  });
  const [problems, setProblems] = useState<MadeProblems>({});
  const [top, setTop] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLSelectElement>(null);
  const quoteOf = (quoteId: string) => quotes.quotes.find((one) => one.id === quoteId);
  const engaged = [...quotes.quotes].sort((a, b) =>
    a.vendor.name.localeCompare(b.vendor.name, i18n.language),
  );

  const set = (change: Partial<MadeDraft>) => {
    const next = { ...draft, ...change };
    setDraft(next);
    setProblems(keptOf(problems, madeProblems(t, next, quoteOf(next.quoteId), at, locale)));
  };

  async function save(): Promise<void> {
    if (busy) return;
    const chosen = quoteOf(draft.quoteId);
    const found = madeProblems(t, draft, chosen, at, locale);
    setProblems(found);
    setTop(null);
    if (Object.keys(found).length > 0 || chosen == null) {
      focusFirstWrong('.desk-dialog');
      return;
    }
    const amount = sentAmount(draft.amount, language, currency) ?? '';
    setBusy(true);
    let paymentId = '';
    try {
      ({ paymentId } = await api.addMadePayment(eventId, chosen.id, {
        description: draft.description.trim(),
        amount,
        currency,
        paidOn: draft.paidOn,
        reference: draft.reference.trim(),
      }));
    } catch (error) {
      setBusy(false);
      const refused = paidRefusedAt(error instanceof ApiError ? error.fieldErrors() : {});
      if (Object.keys(refused.fields).length === 0) {
        setTop(refused.top ?? refusalWords(error, t('budget.form.failed')));
        return;
      }
      setProblems(refused.fields);
      setTop(refused.top);
      focusFirstWrong('.desk-dialog');
      return;
    }
    onSaved({
      quoteId: chosen.id,
      paymentId,
      words: t('quotes.markedPaid', {
        amount: minorMoney(amount, currency, locale),
        day: longDay(draft.paidOn, locale),
      }),
    });
  }

  return (
    <Dialog
      title={t('quotes.alreadyMade')}
      verb={busy ? t('budget.saving') : t('quotes.addAsPaid')}
      on={!busy}
      locked={busy}
      first={first}
      onDismiss={onClose}
      onConfirm={() => void save()}
    >
      <div className="desk-fields">
        {top != null && <AlertInset>{top}</AlertInset>}
        <div className="desk-field">
          <label htmlFor={`${id}-vendor`} className="desk-label">
            {t('quotes.vendor')}
          </label>
          <div className="desk-box">
            <select
              ref={first}
              id={`${id}-vendor`}
              className="pay-select"
              value={draft.quoteId}
              aria-describedby={`${id}-vendor-help`}
              onChange={(event) => set({ quoteId: event.target.value })}
            >
              {engaged.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.vendor.name}
                </option>
              ))}
            </select>
          </div>
          <p id={`${id}-vendor-help`} className="desk-help">
            {t('quotes.onlyQuoted')}
          </p>
        </div>
        <TextField
          id={`${id}-what`}
          label={t('quotes.whatItWasFor')}
          value={draft.description}
          error={problems.description ?? null}
          onChange={(description) => set({ description })}
        />
        <MoneyField
          label={t('quotes.amountPaid')}
          value={draft.amount}
          sign={currencySign(currency, locale)}
          help={t('quotes.inCurrency', { currency })}
          error={problems.amount ?? null}
          onChange={(amount) => set({ amount })}
        />
        <DateField
          id={`${id}-paid`}
          label={t('quotes.datePaid')}
          value={draft.paidOn}
          max={today}
          error={problems.paidOn ?? null}
          onChange={(paidOn) => set({ paidOn })}
        />
        <TextField
          id={`${id}-reference`}
          label={t('quotes.reference')}
          value={draft.reference}
          error={problems.reference ?? null}
          optional
          onChange={(reference) => set({ reference })}
        />
      </div>
    </Dialog>
  );
}
