import {
  ApiError,
  type BudgetLine,
  type EventQuote,
  type EventQuotes,
  type OfferedVendor,
  type ScheduledPayment,
} from '@soirely/api-client';
import { moneyLanguage } from '@soirely/domain';
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Dialog, RowWords, TextAction } from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { amountOfMinor, currencySign, minorMoney } from './budgetArea.ts';
import {
  type ShapeDraft,
  type ShapePricing,
  type Shaping,
  SHAPES,
  anyShapeProblem,
  eventDays,
  retyped,
  shapeRefusedAt,
  shapeRows,
  shapingOf,
  shapingProblems,
  shareWords,
  sharesLine,
  sharesTyped,
  typedTerms,
  whenWords,
} from './paymentShapes.ts';
import type { Amending } from './QuoteParts.tsx';
import {
  BLANK_PAYMENT,
  BLANK_QUOTE,
  type PaymentDraft,
  type PaymentProblems,
  type QuoteDraft,
  type QuoteForm,
  type QuoteProblems,
  agreedElsewhere,
  draftOfQuote,
  keptOf,
  lineLine,
  longDay,
  offered,
  paymentProblems,
  paymentRefusedAt,
  quoteProblems,
  quoteRefusedAt,
  sentAmount,
  shortDay,
  todayIn,
} from './quotesArea.ts';

function focusFirstWrong(within: string): void {
  window.setTimeout(
    () => document.querySelector<HTMLElement>(`${within} [aria-invalid="true"]`)?.focus(),
    0,
  );
}

function AlertInset({ children }: { children: ReactNode }) {
  return (
    <div className="bt-alert" role="alert">
      <Glyph name="alert" size={16} weight={2.3} />
      <p>{children}</p>
    </div>
  );
}

function refusalWords(error: unknown, failed: string): string {
  return error instanceof ApiError && error.problem.detail != null && error.status !== 0
    ? error.problem.detail
    : failed;
}

/** Add (800, two columns), Revise or Correct (540): the vendor is chosen once, on Add; Revise changes the amount or the date; Correct the rest. */
export function QuoteDialog({
  eventId,
  form: opened,
  quotes,
  current,
  lines,
  readsVendors,
  onClose,
  onSaved,
}: {
  eventId: string;
  form: QuoteForm;
  quotes: EventQuotes;
  current: EventQuote | null;
  lines: readonly BudgetLine[];
  readsVendors: boolean;
  onClose: () => void;
  onSaved: (words: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const locale = dateLocale();
  const language = moneyLanguage(i18n.language);
  const { currency } = quotes;
  const at = { language, currency, today: todayIn(quotes.timeZone) };
  const [form, setForm] = useState(opened);
  const [draft, setDraft] = useState<QuoteDraft>(() =>
    current == null ? BLANK_QUOTE : draftOfQuote(current, language, currency),
  );
  const [problems, setProblems] = useState<QuoteProblems>({});
  const [top, setTop] = useState<string | null>(null);
  const [list, setList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [vendors, setVendors] = useState<OfferedVendor[] | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const wrong = Object.keys(problems).length;

  useEffect(() => {
    if (opened !== 'add') return;
    let live = true;
    api.quoteVendors(eventId).then(
      (found) => live && setVendors(found),
      () => undefined,
    );

    return () => {
      live = false;
    };
  }, [eventId, opened]);

  const set = (change: Partial<QuoteDraft>) => {
    const next = { ...draft, ...change };
    setDraft(next);
    setProblems(keptOf(problems, quoteProblems(t, next, form, at, current)));
  };
  const switchTo = (next: 'revise' | 'correct') => {
    if (current == null) return;
    setForm(next);
    setDraft(draftOfQuote(current, language, currency));
    setProblems({});
    setTop(null);
  };

  async function save(): Promise<void> {
    if (busy) return;
    const found = quoteProblems(t, draft, form, at, current);
    setProblems(found);
    setTop(null);
    setList(false);
    if (Object.keys(found).length > 0) {
      focusFirstWrong('.desk-dialog');
      return;
    }
    const amount = sentAmount(draft.amount, language, currency) ?? '';
    const lineIds = draft.lineIds.filter(
      (one) => agreedElsewhere(quotes.quotes, one, current?.id ?? null) == null,
    );
    setBusy(true);
    try {
      if (form === 'add' || current == null) {
        await api.addQuote(eventId, {
          vendorId: draft.vendorId,
          covers: draft.covers.trim(),
          amount,
          currency,
          quotedOn: draft.quotedOn,
          reference: draft.reference.trim(),
          lineIds,
        });
        onSaved(
          t('quotes.quoteAdded', {
            vendor: draft.typed,
            amount: minorMoney(amount, currency, locale),
            day: longDay(draft.quotedOn, locale),
          }),
        );
      } else if (form === 'revise') {
        await api.reviseQuote(eventId, current.id, { amount, currency, quotedOn: draft.quotedOn });
        onSaved(
          t('quotes.quoteRevised', {
            vendor: current.vendor.name,
            amount: minorMoney(amount, currency, locale),
            day: longDay(draft.quotedOn, locale),
          }),
        );
      } else {
        const reference = draft.reference.trim();
        await api.correctQuote(eventId, current.id, {
          covers: draft.covers.trim(),
          reference,
          lineIds,
        });
        onSaved(
          reference === ''
            ? t('quotes.quoteCorrected', { vendor: current.vendor.name })
            : t('quotes.quoteCorrectedNumber', { vendor: current.vendor.name, number: reference }),
        );
      }
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError && error.is('vendor_already_quoted')) {
        setTop(t('quotes.duplicate'));
        return;
      }
      if (error instanceof ApiError && error.is('quote_unchanged')) {
        setProblems({ amount: t('quotes.reviseUnchanged'), quotedOn: t('quotes.reviseUnchanged') });
        focusFirstWrong('.desk-dialog');
        return;
      }
      const refused = quoteRefusedAt(error instanceof ApiError ? error.fieldErrors() : {});
      if (Object.keys(refused.fields).length === 0 && refused.top == null) {
        setTop(refusalWords(error, t('budget.form.failed')));
        return;
      }
      setProblems(refused.fields);
      setTop(refused.top);
      focusFirstWrong('.desk-dialog');
    }
  }

  const vendorField =
    form === 'add' ? (
      <VendorField
        id={`${id}-vendor`}
        inputRef={first}
        vendors={vendors}
        draft={draft}
        open={list}
        error={problems.vendor ?? null}
        readsVendors={readsVendors}
        onOpen={setList}
        onType={(typed) => {
          setDraft({ ...draft, typed, vendorId: '' });
          setList(true);
        }}
        onChoose={(vendor) => {
          setDraft({ ...draft, typed: vendor.name, vendorId: vendor.id });
          setProblems(({ vendor: _vendor, ...rest }) => rest);
          setList(false);
        }}
      />
    ) : (
      <Fixed label={t('quotes.vendor')} value={current?.vendor.name ?? ''} />
    );
  const covers = (
    <TextField
      id={`${id}-covers`}
      label={t('quotes.whatItCovers')}
      value={draft.covers}
      error={problems.covers ?? null}
      lines={3}
      onChange={(covers) => set({ covers })}
    />
  );
  const reference = (
    <TextField
      id={`${id}-reference`}
      label={t('quotes.quoteNumber')}
      value={draft.reference}
      error={problems.reference ?? null}
      optional
      help={t('quotes.numberHelp')}
      onChange={(next) => set({ reference: next })}
    />
  );
  const amount = (
    <MoneyField
      label={t('quotes.amount')}
      value={draft.amount}
      sign={currencySign(currency, locale)}
      help={t('quotes.inCurrency', { currency })}
      error={problems.amount ?? null}
      {...(form === 'revise' ? { inputRef: first } : {})}
      onChange={(next) => set({ amount: next })}
    />
  );
  const quotedOn = (
    <DateField
      id={`${id}-quoted`}
      label={t('quotes.dateQuoted')}
      value={draft.quotedOn}
      max={at.today}
      error={problems.quotedOn ?? null}
      onChange={(next) => set({ quotedOn: next })}
    />
  );
  const linesField = (
    <LinesField
      lines={lines}
      quotes={quotes}
      quoteId={current?.id ?? null}
      ticked={draft.lineIds}
      onTick={(lineIds) => set({ lineIds })}
    />
  );
  const titles = {
    add: t('quotes.addAQuote'),
    revise: t('quotes.reviseTheQuote'),
    correct: t('quotes.correctTheQuote'),
  };
  const verbs = { add: t('quotes.add'), revise: t('quotes.revise'), correct: t('budget.save') };

  return (
    <Dialog
      title={titles[form]}
      verb={busy ? t('budget.saving') : verbs[form]}
      on={!busy}
      locked={busy}
      first={first}
      onDismiss={onClose}
      onConfirm={() => void save()}
    >
      {form === 'add' && <span className="qt-width is-800" hidden />}
      <div className="desk-fields">
        {top != null && <AlertInset>{top}</AlertInset>}
        {form === 'add' && wrong > 1 && (
          <p className="desk-error" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {t('budget.form.fieldsWrong', { count: wrong })}
          </p>
        )}
        {form === 'revise' && <p className="desk-note">{t('quotes.reviseIntro')}</p>}
        {form === 'correct' && (
          <>
            <p className="desk-note">{t('quotes.correctIntro')}</p>
            <TextAction label={t('quotes.reviseInstead')} onClick={() => switchTo('revise')} />
          </>
        )}
        {form === 'add' ? (
          <div className="qt-two">
            <div className="desk-fields">
              {vendorField}
              {covers}
              {reference}
            </div>
            <div className="desk-fields">
              {amount}
              {quotedOn}
              {linesField}
            </div>
          </div>
        ) : form === 'revise' ? (
          <>
            {vendorField}
            {amount}
            {quotedOn}
            {problems.amount != null && problems.amount === problems.quotedOn && (
              <TextAction label={t('quotes.correctInstead')} onClick={() => switchTo('correct')} />
            )}
          </>
        ) : (
          <>
            {vendorField}
            {covers}
            {current != null && (
              <>
                <Fixed
                  label={t('quotes.amount')}
                  value={minorMoney(current.quote.amount, currency, locale)}
                />
                <Fixed
                  label={t('quotes.dateQuoted')}
                  value={longDay(current.quote.quotedOn, locale)}
                />
              </>
            )}
            {reference}
            {linesField}
          </>
        )}
      </div>
    </Dialog>
  );
}

/** The organisation's vendors not archived, narrowing as a name is typed; one already quoted on the event is shown and cannot be chosen. */
function VendorField({
  id,
  inputRef,
  vendors,
  draft,
  open,
  error,
  readsVendors,
  onOpen,
  onType,
  onChoose,
}: {
  id: string;
  inputRef: RefObject<HTMLInputElement | null>;
  vendors: readonly OfferedVendor[] | null;
  draft: QuoteDraft;
  open: boolean;
  error: string | null;
  readsVendors: boolean;
  onOpen: (open: boolean) => void;
  onType: (typed: string) => void;
  onChoose: (vendor: OfferedVendor) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const [active, setActive] = useState(0);
  const blurred = useRef<number | undefined>(undefined);
  const typed = draft.vendorId === '' ? draft.typed : '';
  const rows = offered(vendors ?? [], typed, locale);
  const none = vendors != null && vendors.every((one) => one.archived);
  const showList = open && !none && rows.length > 0;
  const told = [error == null ? null : `${id}-error`, `${id}-status`].filter(Boolean).join(' ');
  const choose = (vendor: OfferedVendor | undefined) => {
    if (vendor == null || vendor.quoted) return;
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
      event.stopPropagation();
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
        {t('quotes.vendor')}
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
          placeholder={t('quotes.typeAName')}
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
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={t('quotes.vendors')}
          className="qt-options"
        >
          {rows.map((vendor, index) => (
            <li
              key={vendor.id}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              aria-disabled={vendor.quoted}
              className={['qt-option', index === active && 'is-active', vendor.quoted && 'is-taken']
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
                  vendor.contactName == null || vendor.contactName === ''
                    ? t(`vendors.categories.${vendor.category}`)
                    : t('quotes.vendorLine', {
                        category: t(`vendors.categories.${vendor.category}`),
                        contact: vendor.contactName,
                      }),
                  ...(vendor.quoted ? [t('quotes.alreadyQuoted')] : []),
                ]}
              />
            </li>
          ))}
        </ul>
      )}
      <div id={`${id}-status`} role="status" className="qt-vendor-status">
        {(none || (open && vendors != null && rows.length === 0 && typed.trim() !== '')) && (
          <>
            <p className="desk-line is-ink">
              {none ? t('quotes.noVendors') : t('quotes.noVendorMatches', { typed: typed.trim() })}
            </p>
            {readsVendors ? (
              <Link className="desk-text" to="/app/settings/vendors">
                {t('quotes.addOnVendors')}
              </Link>
            ) : (
              <p className="desk-line">{t('quotes.askToAdd')}</p>
            )}
          </>
        )}
      </div>
      <Problem id={`${id}-error`} line={error} />
    </div>
  );
}

/** Every cost on the event: one agreed in another vendor's quote says whose, and cannot be ticked. */
function LinesField({
  lines,
  quotes,
  quoteId,
  ticked,
  onTick,
}: {
  lines: readonly BudgetLine[];
  quotes: EventQuotes;
  quoteId: string | null;
  ticked: readonly string[];
  onTick: (lineIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const locale = dateLocale();

  return (
    <div className="desk-field qt-lines" role="group" aria-labelledby={id}>
      <div className="qt-label-row">
        <span id={id} className="desk-label">
          {t('quotes.linesItAgrees')}
        </span>
        <span className="qt-optional">{t('quotes.optional')}</span>
      </div>
      <ul className="desk-rows">
        {lines.map((line) => {
          const holder = agreedElsewhere(quotes.quotes, line.id, quoteId);

          return (
            <li key={line.id}>
              <label className={holder == null ? 'desk-row qt-line' : 'desk-row qt-line is-taken'}>
                <input
                  type="checkbox"
                  className="qt-check"
                  checked={holder == null && ticked.includes(line.id)}
                  disabled={holder != null}
                  onChange={() =>
                    onTick(
                      ticked.includes(line.id)
                        ? ticked.filter((one) => one !== line.id)
                        : [...ticked, line.id],
                    )
                  }
                />
                <RowWords title={line.label} lines={[lineLine(t, line, holder, locale)]} />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function paymentTyped(draft: PaymentDraft, amount: string, currency: string) {
  return { description: draft.description.trim(), amount, currency, dueOn: draft.dueOn };
}

/** Add a payment, 700: what it is for across, then the amount and the date due side by side; for a vendor with no payments yet, How it is paid first (sc-1332). */
export function PaymentDialog({
  eventId,
  event,
  quote,
  quotes,
  onClose,
  onSaved,
  onRaced,
}: {
  eventId: string;
  event: { startsAt: string; endsAt: string; timeZone: string };
  quote: EventQuote;
  quotes: EventQuotes;
  onClose: () => void;
  onSaved: (words: string) => void;
  onRaced: () => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const locale = dateLocale();
  const language = moneyLanguage(i18n.language);
  const { currency } = quotes;
  const [draft, setDraft] = useState<PaymentDraft>(BLANK_PAYMENT);
  const [problems, setProblems] = useState<PaymentProblems>({});
  const [shaping, setShaping] = useState<Shaping | null>(() =>
    quote.payments.length === 0 ? shapingOf(t, 'rows') : null,
  );
  const [top, setTop] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const picked = useRef<HTMLInputElement>(null);
  const shaped = shaping != null && shaping.shape !== 'rows';
  const pricing: ShapePricing = { quote: quote.quote, currency, days: eventDays(event), locale };
  const rows = shaped ? shapeRows(typedTerms(shaping), pricing.quote, currency, pricing.days) : [];
  const short =
    shaped && sharesTyped(shaping) ? sharesLine(t, rows, quote.quote, currency, locale) : null;

  const set = (change: Partial<PaymentDraft>) => {
    const next = { ...draft, ...change };
    setDraft(next);
    setProblems(keptOf(problems, paymentProblems(t, next, quote, { language, currency }, locale)));
  };

  async function saveShaped(now: Shaping): Promise<void> {
    const found = shapingProblems(t, now, pricing);
    setShaping({ ...now, problems: found });
    setTop(null);
    if (anyShapeProblem(found)) {
      focusFirstWrong('.desk-dialog');
      return;
    }
    setBusy(true);
    try {
      await api.addSchedule(
        eventId,
        quote.id,
        rows.map((row) => ({
          description: row.what,
          amount: amountOfMinor(row.amountMinor, currency),
          currency,
          dueOn: row.dueOn,
        })),
      );
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError && error.is('payments_already_scheduled')) {
        setTop(t('quotes.shapeRaced'));
        onRaced();
        return;
      }
      const refused = error instanceof ApiError ? error.fieldErrors() : {};
      const fields = shapeRefusedAt(refused, now.terms);
      if (fields == null) {
        setTop(
          error instanceof ApiError && error.status !== 0 && error.status < 500
            ? refusalWords(error, t('budget.form.failed'))
            : t('quotes.shapeFailed', { count: now.terms.length }),
        );
        return;
      }
      setShaping({ ...now, problems: fields.rows });
      setTop(fields.top);
      focusFirstWrong('.desk-dialog');
      return;
    }
    onSaved(
      rows
        .map((row) =>
          t('quotes.paymentAdded', {
            what: row.what,
            amount: minorMoney(amountOfMinor(row.amountMinor, currency), currency, locale),
            day: longDay(row.dueOn, locale),
          }),
        )
        .join(' '),
    );
  }

  async function save(): Promise<void> {
    if (busy) return;
    if (shaped) {
      await saveShaped(shaping);
      return;
    }
    const found = paymentProblems(t, draft, quote, { language, currency }, locale);
    setProblems(found);
    setTop(null);
    if (Object.keys(found).length > 0) {
      focusFirstWrong('.desk-dialog');
      return;
    }
    const amount = sentAmount(draft.amount, language, currency) ?? '';
    setBusy(true);
    try {
      await api.addPayment(eventId, quote.id, paymentTyped(draft, amount, currency));
    } catch (error) {
      setBusy(false);
      const refused = paymentRefusedAt(error instanceof ApiError ? error.fieldErrors() : {});
      if (Object.keys(refused.fields).length === 0 && refused.top == null) {
        setTop(refusalWords(error, t('budget.form.failed')));
        return;
      }
      setProblems(refused.fields);
      setTop(refused.top);
      focusFirstWrong('.desk-dialog');
      return;
    }
    onSaved(
      t('quotes.paymentAdded', {
        what: draft.description.trim(),
        amount: minorMoney(amount, currency, locale),
        day: longDay(draft.dueOn, locale),
      }),
    );
  }

  return (
    <Dialog
      title={t('quotes.addAPayment')}
      verb={
        busy
          ? t('budget.saving')
          : shaped
            ? t('quotes.saveShapes', { count: shaping.terms.length })
            : t('quotes.add')
      }
      on={!busy}
      locked={busy}
      first={shaping == null ? first : picked}
      onDismiss={onClose}
      onConfirm={() => void save()}
    >
      <span className="qt-width is-700" hidden />
      <div className="desk-fields">
        {top != null && <AlertInset>{top}</AlertInset>}
        {shaping != null && (
          <fieldset className="qt-shapes">
            <legend className="qt-legend">{t('quotes.howItIsPaid')}</legend>
            <ul className="desk-rows bt-rows">
              {SHAPES.map((shape) => (
                <li key={shape}>
                  <label
                    className={
                      shape === shaping.shape ? 'desk-row qt-shape is-chosen' : 'desk-row qt-shape'
                    }
                  >
                    <input
                      ref={shape === shaping.shape ? picked : undefined}
                      type="radio"
                      className="desk-radio"
                      name={`${id}-shape`}
                      checked={shape === shaping.shape}
                      onChange={() => {
                        setShaping(shapingOf(t, shape));
                        setTop(null);
                      }}
                    />
                    <RowWords title={t(`quotes.shapeName.${shape}`)} />
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        {shaped ? (
          <>
            <ul className="desk-rows bt-rows">
              {rows.map((row, index) => {
                const typed = shaping.typed[index];
                const wrong = shaping.problems[index] ?? {};
                const at = `${id}-row-${index}`;
                const retype = (change: Partial<ShapeDraft>) =>
                  setShaping(retyped(t, shaping, index, change, pricing));

                return (
                  <li key={at} className="qt-shape-row">
                    <div className="desk-row bt-row">
                      <RowWords
                        title={row.what === '' ? t('quotes.noDescription') : row.what}
                        lines={[
                          t(row.clamped ? 'quotes.shapeLineClamped' : 'quotes.shapeLine', {
                            share: shareWords(row.share, locale),
                            when: whenWords(t, row),
                            day: shortDay(row.dueOn, locale),
                          }),
                        ]}
                      />
                      <span className="bt-amount">
                        <span className="bt-amount-value">
                          {minorMoney(amountOfMinor(row.amountMinor, currency), currency, locale)}
                        </span>
                      </span>
                    </div>
                    {typed != null && (
                      <div className="desk-fields">
                        <TextField
                          id={`${at}-what`}
                          label={t('quotes.whatFor')}
                          value={typed.what}
                          error={wrong.what ?? null}
                          onChange={(what) => retype({ what })}
                        />
                        <div className="qt-two">
                          <TextField
                            id={`${at}-share`}
                            label={t('quotes.shareField')}
                            value={typed.share}
                            help={t('quotes.shareHelp')}
                            error={wrong.share ?? null}
                            onChange={(share) => retype({ share })}
                          />
                          {row.from !== 'quoted' && (
                            <TextField
                              id={`${at}-days`}
                              label={t(
                                row.from === 'before'
                                  ? 'quotes.daysBeforeField'
                                  : 'quotes.daysAfterField',
                              )}
                              value={typed.days}
                              help={t('quotes.shapeDaysHelp')}
                              error={wrong.days ?? null}
                              onChange={(days) => retype({ days })}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {short == null ? (
              <p className="qt-note">{t('quotes.eachRowSaved')}</p>
            ) : (
              <p className="qt-note is-amber">{short}</p>
            )}
          </>
        ) : (
          <>
            <Fixed label={t('quotes.vendor')} value={quote.vendor.name} />
            <PaymentFields
              id={id}
              draft={draft}
              problems={problems}
              first={first}
              currency={currency}
              onSet={set}
            />
          </>
        )}
      </div>
    </Dialog>
  );
}

function PaymentFields({
  id,
  draft,
  problems,
  first,
  currency,
  stacked = false,
  onSet,
}: {
  id: string;
  draft: PaymentDraft;
  problems: PaymentProblems;
  first: RefObject<HTMLInputElement | null>;
  currency: string;
  stacked?: boolean;
  onSet: (change: Partial<PaymentDraft>) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <TextField
        id={`${id}-what`}
        label={t('quotes.whatFor')}
        value={draft.description}
        error={problems.description ?? null}
        inputRef={first}
        help={t('quotes.whatForHelp')}
        onChange={(description) => onSet({ description })}
      />
      <div className={stacked ? 'desk-fields' : 'qt-two'}>
        <MoneyField
          label={t('quotes.amount')}
          value={draft.amount}
          sign={currencySign(currency, dateLocale())}
          help={t('quotes.inCurrency', { currency })}
          error={problems.amount ?? null}
          onChange={(amount) => onSet({ amount })}
        />
        <DateField
          id={`${id}-due`}
          label={t('quotes.dateDue')}
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
  eventId,
  amending,
  payment,
  quote,
  quotes,
  onAmending,
  onCancel,
  onSaved,
}: {
  eventId: string;
  amending: Amending;
  payment: ScheduledPayment;
  quote: EventQuote;
  quotes: EventQuotes;
  onAmending: (next: Amending) => void;
  onCancel: () => void;
  onSaved: (words: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const locale = dateLocale();
  const language = moneyLanguage(i18n.language);
  const { currency } = quotes;
  const { draft, problems } = amending;
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => {
    first.current?.focus();
  }, []);

  const set = (change: Partial<PaymentDraft>) => {
    const next = { ...draft, ...change };
    onAmending({
      ...amending,
      draft: next,
      problems: keptOf(problems, paymentProblems(t, next, quote, { language, currency }, locale)),
    });
  };

  async function save(): Promise<void> {
    if (busy) return;
    const found = paymentProblems(t, draft, quote, { language, currency }, locale);
    onAmending({ ...amending, problems: found });
    setTop(null);
    if (Object.keys(found).length > 0) {
      focusFirstWrong('.bt-opened');
      return;
    }
    const amount = sentAmount(draft.amount, language, currency) ?? '';
    setBusy(true);
    try {
      await api.amendPayment(eventId, payment.id, paymentTyped(draft, amount, currency));
    } catch (error) {
      setBusy(false);
      const refused = paymentRefusedAt(error instanceof ApiError ? error.fieldErrors() : {});
      if (Object.keys(refused.fields).length === 0 && refused.top == null) {
        setTop(refusalWords(error, t('budget.form.failed')));
        return;
      }
      onAmending({ ...amending, problems: refused.fields });
      setTop(refused.top);
      focusFirstWrong('.bt-opened');
      return;
    }
    onSaved(
      t('quotes.paymentChanged', {
        what: draft.description.trim(),
        amount: minorMoney(amount, currency, locale),
        day: longDay(draft.dueOn, locale),
      }),
    );
  }

  const keys = useRef({ save, onCancel });

  useEffect(() => {
    keys.current = { save, onCancel };
  });

  useEffect(() => {
    const box = area.current;
    const press = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        keys.current.onCancel();
      } else if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        void keys.current.save();
      }
    };
    box?.addEventListener('keydown', press);

    return () => box?.removeEventListener('keydown', press);
  }, []);

  return (
    <div ref={area} className="bt-opened">
      <div className="bt-opened-in">
        {top != null && <AlertInset>{top}</AlertInset>}
        <PaymentFields
          id={id}
          draft={draft}
          problems={problems}
          first={first}
          currency={currency}
          stacked
          onSet={set}
        />
        <div className="bt-opened-actions">
          <TextAction label={t('budget.cancel')} onClick={onCancel} />
          <button
            type="button"
            className={busy ? 'desk-text is-off' : 'desk-text'}
            aria-disabled={busy}
            onClick={() => void save()}
          >
            {busy ? t('budget.saving') : t('budget.save')}
          </button>
        </div>
      </div>
    </div>
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
  const { t } = useTranslation();

  return optional ? (
    <div className="qt-label-row">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <span className="qt-optional">{t('quotes.optional')}</span>
    </div>
  ) : (
    <label htmlFor={id} className="desk-label">
      {label}
    </label>
  );
}

function TextField({
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

function DateField({
  id,
  label,
  value,
  max,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max?: string;
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
          max={max}
          aria-invalid={error != null}
          aria-describedby={described(id, false, error)}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <Problem id={`${id}-error`} line={error} />
    </div>
  );
}

function MoneyField({
  label,
  value,
  sign,
  help,
  error,
  inputRef,
  onChange,
}: {
  label: string;
  value: string;
  sign: string;
  help: string;
  error: string | null;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="desk-field bt-money">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <span className="bt-symbol" aria-hidden="true">
          {sign}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          spellCheck={false}
          aria-invalid={error != null}
          aria-describedby={described(id, true, error)}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <p id={`${id}-help`} className="desk-help">
        {help}
      </p>
      <Problem id={`${id}-error`} line={error} />
    </div>
  );
}
