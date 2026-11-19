import {
  ApiError,
  type BudgetMargin,
  type ChargedLine,
  type OrganisationEvent,
  VENDOR_CATEGORIES,
  type VendorCategory,
} from '@soirely/api-client';
import { amountExample, moneyLanguage, numberFormat, typedAmount } from '@soirely/domain';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Chevron, Dialog, Head, OnCard, RowWords } from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import {
  currencySign,
  minorMoney,
  minorOf,
  priceProblem,
  sentPrice,
  wholeMoney,
} from './budgetArea.ts';
import {
  markupProblem,
  markupProblemWords,
  marginOfTyped,
  percentWords,
  rowWords,
  sentMarkup,
  shareRange,
  shareWords,
  wholeRange,
} from './budgetMargin.ts';
import { CoverCard, MoneyField } from './BudgetParts.tsx';

/** A's card, its margin face (sc-92): the client's figures and the agency's, never on a share or a printout. */
export function MarginCard({
  event,
  margin,
  washed,
}: {
  event: OrganisationEvent;
  margin: BudgetMargin;
  washed: boolean;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const range = (pair: BudgetMargin['total']['client']) =>
    wholeRange(t, pair, margin.currency, locale);
  const pairs = [
    {
      label: t('budget.margin.clientTotal'),
      figure: range(margin.total.client),
      sub: t('budget.margin.clientPays'),
    },
    {
      label: t('budget.margin.internalCost'),
      figure: range(margin.total.cost),
      sub: t('budget.margin.costsYou'),
    },
    {
      label: t('budget.margin.margin'),
      figure: range(margin.total.margin),
      sub: shareRange(t, margin.total, locale),
    },
  ];

  return (
    <CoverCard event={event}>
      <ul className={washed ? 'desk-glass-tags is-washed' : 'desk-glass-tags'}>
        <li className="desk-glass">{t('budget.margin.enterprise')}</li>
        <li className="desk-glass">{t('budget.margin.whoSees')}</li>
      </ul>
      <dl className={washed ? 'bt-pairs bt-margin-pairs is-washed' : 'bt-pairs bt-margin-pairs'}>
        {pairs.map((one) => (
          <div key={one.label} className="bt-pair">
            <dt>{one.label}</dt>
            <dd className="bt-pair-figure">{one.figure}</dd>
            <dd className="bt-pair-sub">{one.sub}</dd>
          </div>
        ))}
      </dl>
      <OnCard>{t('budget.margin.never')}</OnCard>
    </CoverCard>
  );
}

/** The costs on the margin face: each with Cost and Charged at, and opening one edits Charged at, the client price (ux, 19 Nov). */
export function MarginCosts({
  eventId,
  margin,
  shownIds,
  onSaved,
}: {
  eventId: string;
  margin: BudgetMargin;
  shownIds: ReadonlySet<string>;
  onSaved: (margin: BudgetMargin, id: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const locale = dateLocale();
  const [opened, setOpened] = useState<string | null>(null);
  const [said, setSaid] = useState<{ id: string; words: string; ok: boolean } | null>(null);
  const lines = margin.lines.filter((one) => shownIds.has(one.id) || one.source === 'price');
  const categories = VENDOR_CATEGORIES.filter((category) =>
    lines.some((one) => one.category === category),
  );

  return (
    <section className="desk-block bt-block" aria-labelledby={id}>
      <Head title={<span id={id}>{t('budget.costs')}</span>} />
      {categories.map((category) => (
        <div key={category} className="bt-cat">
          <div className="bt-category">
            <h3>{t(`vendors.categories.${category}`)}</h3>
          </div>
          <ul className="desk-rows bt-rows">
            {lines
              .filter((one) => one.category === category)
              .map((one) => (
                <li key={one.id} data-line={one.id}>
                  {opened === one.id ? (
                    <OpenedCharge
                      eventId={eventId}
                      line={one}
                      currency={margin.currency}
                      onCancel={() => setOpened(null)}
                      onSaved={(next) => {
                        setOpened(null);
                        setSaid({ id: one.id, words: t('budget.saved'), ok: true });
                        onSaved(next, one.id);
                      }}
                      onFailed={() => {
                        setOpened(null);
                        setSaid({ id: one.id, words: t('budget.form.failed'), ok: false });
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="desk-row bt-row"
                      aria-expanded={false}
                      onClick={() => {
                        setOpened(one.id);
                        setSaid(null);
                      }}
                    >
                      <RowWords
                        title={one.label}
                        lines={[rowWords(t, one, margin.currency, locale)]}
                      />
                      <span className="bt-amount">
                        {shareWords(t, one.share.confirmed, locale)}
                      </span>
                      <Chevron />
                    </button>
                  )}
                  {said?.id === one.id && opened !== one.id && (
                    <p className={said.ok ? 'bt-said is-ok' : 'bt-said is-wrong'} role="status">
                      <Glyph name={said.ok ? 'tick' : 'clear'} size={15} weight={2.6} />
                      {said.words}
                    </p>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function OpenedCharge({
  eventId,
  line,
  currency,
  onCancel,
  onSaved,
  onFailed,
}: {
  eventId: string;
  line: ChargedLine;
  currency: string;
  onCancel: () => void;
  onSaved: (margin: BudgetMargin) => void;
  onFailed: () => void;
}) {
  const { t, i18n } = useTranslation();
  const language = moneyLanguage(i18n.language);
  const locale = dateLocale();
  const [typed, setTyped] = useState(() => typedAmount(line.client.confirmed, language, currency));
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  const box = useRef<HTMLDivElement>(null);
  const keyed = useRef<(key: KeyboardEvent) => void>(() => undefined);

  useEffect(() => field.current?.focus(), []);
  const check = (text: string): string | null => {
    if (text.trim() === '') return null;
    const found = priceProblem(text, language, currency);
    if (found === 'decimals')
      return t('budget.margin.priceDecimals', { example: amountExample(language, currency) });

    return found == null
      ? null
      : t('budget.margin.priceNumber', { min: numberFormat(locale).format(0) });
  };
  const sent = sentPrice(typed, language, currency);
  const below =
    problem == null &&
    sent != null &&
    minorOf(sent, currency) < minorOf(line.cost.confirmed, currency);

  async function save(): Promise<void> {
    if (busy) return;
    const found = check(typed);
    setProblem(found);
    if (found != null) {
      field.current?.focus();
      return;
    }
    setBusy(true);
    try {
      onSaved(
        await api.chargeBudgetLine(eventId, line.id, sent == null ? {} : { price: sent, currency }),
      );
    } catch (error) {
      setBusy(false);
      const refused = error instanceof ApiError ? error.fieldErrors() : {};
      const words = refused.price ?? refused.currency;
      if (words != null) {
        setProblem(words);
        field.current?.focus();
        return;
      }
      onFailed();
    }
  }

  useEffect(() => {
    keyed.current = (key) => {
      if (key.key === 'Escape') {
        key.preventDefault();
        key.stopPropagation();
        onCancel();
      } else if (key.key === 'Enter' && key.target instanceof HTMLInputElement) {
        key.preventDefault();
        void save();
      }
    };
  });
  useEffect(() => {
    const node = box.current;
    if (node == null) return;
    const keys = (key: KeyboardEvent) => keyed.current(key);
    node.addEventListener('keydown', keys);

    return () => node.removeEventListener('keydown', keys);
  }, []);

  return (
    <div className="bt-opened">
      <div className="bt-opened-in" ref={box} role="group" aria-label={line.label}>
        <p className="bt-opened-name">{line.label}</p>
        <MoneyField
          label={t('budget.margin.chargedAt')}
          value={typed}
          sign={currencySign(currency, locale)}
          help={t('budget.margin.costHelp', {
            cost: minorMoney(line.cost.confirmed, currency, locale),
          })}
          error={problem}
          inputRef={field}
          onChange={(value) => {
            setTyped(value);
            if (problem != null) setProblem(check(value));
          }}
        />
        {below && sent != null && (
          <p className="bt-below" role="status">
            <Glyph name="arrowDown" size={16} weight={2.6} />
            {t('budget.margin.belowCost', {
              margin: marginOfTyped(sent, line.cost.confirmed, currency, locale),
            })}
          </p>
        )}
        <div className="bt-opened-actions">
          <button type="button" className="desk-text" onClick={onCancel}>
            {t('budget.cancel')}
          </button>
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

type Scope = 'event' | 'category' | 'cost';

export interface MarkupOpening {
  scope: Scope;
  key: string;
}

/** The markups as one list beside the costs: the whole event, then category overrides, then each cost's own. */
export function MarkupBlock({
  margin,
  onOpen,
}: {
  margin: BudgetMargin;
  onOpen: (opening: MarkupOpening) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const locale = dateLocale();
  const markupIs = (markup: string) =>
    Number(markup) === 0
      ? t('budget.margin.atCostChosen')
      : t('budget.margin.markupIs', { markup: percentWords(markup, locale) });
  const rows: { name: string; how: string; opening: MarkupOpening }[] = [
    {
      name: t('budget.margin.wholeEvent'),
      how:
        margin.markups.event == null
          ? t('budget.margin.noMarkupSet')
          : t('budget.margin.markupIs', { markup: percentWords(margin.markups.event, locale) }),
      opening: { scope: 'event', key: '' },
    },
    ...VENDOR_CATEGORIES.flatMap((category) => {
      const markup = margin.markups.categories[category];

      return markup == null
        ? []
        : [
            {
              name: t(`vendors.categories.${category}`),
              how: markupIs(markup),
              opening: { scope: 'category' as const, key: category },
            },
          ];
    }),
    ...margin.lines.flatMap((line) =>
      line.source === 'line' && line.markup != null
        ? [
            {
              name: line.label,
              how: markupIs(line.markup),
              opening: { scope: 'cost' as const, key: line.id },
            },
          ]
        : line.source === 'price'
          ? [
              {
                name: line.label,
                how: t('budget.margin.itsOwnPrice'),
                opening: { scope: 'cost' as const, key: line.id },
              },
            ]
          : [],
    ),
  ];

  return (
    <section className="desk-block bt-block" aria-labelledby={id}>
      <Head title={<span id={id}>{t('budget.margin.markups')}</span>} />
      <ul className="desk-rows bt-rows">
        {rows.map((row) => (
          <li key={`${row.opening.scope}-${row.opening.key}`}>
            <button type="button" className="desk-row bt-row" onClick={() => onOpen(row.opening)}>
              <RowWords title={row.name} lines={[row.how]} />
              <Chevron />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const SCOPES: readonly Scope[] = ['event', 'category', 'cost'];

/** Markup for the whole event, a category or one cost; emptying it takes that markup away (pm, 19 Nov). */
export function MarkupDialog({
  eventId,
  margin,
  opening,
  onDismiss,
  onSaved,
}: {
  eventId: string;
  margin: BudgetMargin;
  opening: MarkupOpening;
  onDismiss: () => void;
  onSaved: (margin: BudgetMargin) => void;
}) {
  const { t, i18n } = useTranslation();
  const language = moneyLanguage(i18n.language);
  const locale = dateLocale();
  const id = useId();
  const [scope, setScope] = useState<Scope>(opening.scope);
  const [category, setCategory] = useState<VendorCategory>(
    opening.scope === 'category' ? (opening.key as VendorCategory) : 'catering',
  );
  const [cost, setCost] = useState(
    opening.scope === 'cost' ? opening.key : (margin.lines[0]?.id ?? ''),
  );
  const held =
    scope === 'event'
      ? margin.markups.event
      : scope === 'category'
        ? (margin.markups.categories[category] ?? null)
        : (margin.lines.find((one) => one.id === cost && one.source === 'line')?.markup ?? null);
  const [typed, setTyped] = useState<string | null>(null);
  const shown = typed ?? (held == null ? '' : language === 'en' ? held : held.replace('.', ','));
  const [tried, setTried] = useState(false);
  const [server, setServer] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const found = markupProblem(shown, language);
  const problem = (tried && found != null ? markupProblemWords(t, found, locale) : null) ?? server;
  const example = (amount: number) => wholeMoney(String(amount), margin.currency, locale);

  async function save(): Promise<void> {
    if (busy) return;
    setTried(true);
    setServer(null);
    setFailed(false);
    if (found != null) {
      field.current?.focus();
      return;
    }
    const markup = sentMarkup(shown, language);
    setBusy(true);
    try {
      onSaved(
        scope === 'cost'
          ? await api.chargeBudgetLine(eventId, cost, markup == null ? {} : { markup })
          : await api.setBudgetMarkup(eventId, scope === 'category' ? category : null, markup),
      );
    } catch (error) {
      setBusy(false);
      const words = error instanceof ApiError ? error.fieldErrors().markup : undefined;
      if (words != null) {
        setServer(words);
        field.current?.focus();
        return;
      }
      setFailed(true);
    }
  }

  return (
    <Dialog
      title={t('budget.margin.dialog.title')}
      verb={busy ? t('budget.saving') : t('budget.save')}
      locked={busy}
      first={field}
      onDismiss={onDismiss}
      onConfirm={() => void save()}
    >
      {failed && (
        <div className="bt-alert" role="alert">
          <Glyph name="alert" size={16} weight={2.3} />
          <p>{t('budget.form.failed')}</p>
        </div>
      )}
      <fieldset className="bt-bases">
        <legend className="visually-hidden">{t('budget.margin.dialog.for')}</legend>
        <ul className="desk-rows">
          {SCOPES.map((one) => (
            <li key={one}>
              <label className={scope === one ? 'desk-row is-picked' : 'desk-row'}>
                <input
                  type="radio"
                  className="desk-radio"
                  name={`${id}-scope`}
                  checked={scope === one}
                  onChange={() => {
                    setScope(one);
                    setTyped(null);
                    setServer(null);
                  }}
                />
                <RowWords
                  title={t(`budget.margin.dialog.${one}`)}
                  lines={[t(`budget.margin.dialog.${one}Line`)]}
                />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {scope === 'category' && (
        <div className="desk-field">
          <label htmlFor={`${id}-category`} className="desk-label">
            {t('budget.margin.dialog.categoryLabel')}
          </label>
          <div className="desk-box">
            <select
              id={`${id}-category`}
              className="bt-select"
              value={category}
              onChange={(change) => {
                setCategory(change.target.value as VendorCategory);
                setTyped(null);
              }}
            >
              {VENDOR_CATEGORIES.map((one) => (
                <option key={one} value={one}>
                  {t(`vendors.categories.${one}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {scope === 'cost' && (
        <div className="desk-field">
          <label htmlFor={`${id}-cost`} className="desk-label">
            {t('budget.margin.dialog.costLabel')}
          </label>
          <div className="desk-box">
            <select
              id={`${id}-cost`}
              className="bt-select"
              value={cost}
              onChange={(change) => {
                setCost(change.target.value);
                setTyped(null);
              }}
            >
              {margin.lines.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <MoneyField
        label={t('budget.margin.dialog.field')}
        value={shown}
        sign=""
        unit="%"
        help={t('budget.margin.dialog.help', {
          cost: example(1000),
          markup: percentWords(25, locale),
          charged: example(1250),
        })}
        error={problem}
        inputRef={field}
        onChange={(value) => {
          setTyped(value);
          setServer(null);
        }}
      />
      <p className="desk-note">
        {t('budget.margin.dialog.note', {
          markup: percentWords(20, locale),
          margin: percentWords(16.7, locale, 1),
        })}
      </p>
    </Dialog>
  );
}
