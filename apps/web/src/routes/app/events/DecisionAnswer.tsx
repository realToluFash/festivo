import { type WhatIf } from '@soirely/api-client';
import { Fragment, type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { RowWords } from '../../../components/SettingsParts.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { figureGroups, wholeMoney } from './exactMoney.ts';
import { type Asked } from './whatAddingCosts.ts';
import './decisionAnswer.css';

/** A status message (WCAG 2.2 SC 4.1.3): the new answer is announced once it arrives; the wait is not. */
export function DecisionAnswer({ asked }: { asked: Asked }) {
  const { t } = useTranslation();
  const id = useId();

  if (asked.kind === 'none') return null;

  const updating = asked.kind === 'updating';

  return (
    <section className="da-answer" role="status" aria-busy={updating} aria-labelledby={id}>
      <h3 id={id} className="da-head">
        {t('decisionAnswer.head')}
      </h3>
      {asked.kind === 'updating' ? (
        <div className="da-bones" aria-hidden="true">
          <span className="da-bone is-big" />
          <span className="da-bone" />
          <span className="da-bone is-short" />
        </div>
      ) : (
        <Answered answer={asked.answer} />
      )}
    </section>
  );
}

function Answered({ answer }: { answer: WhatIf }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const money = (amount: string) => wholeMoney(amount, answer.currency, locale);
  const unknown = answer.lines.filter((line) => !line.known);
  const rows = [...answer.lines.filter((line) => line.known), ...unknown];

  if (answer.lines.length === 0)
    return (
      <>
        <p className="da-big">{t('decisionAnswer.noChange')}</p>
        <p className="da-line">{t('decisionAnswer.nothingPerGuest')}</p>
      </>
    );

  return (
    <>
      {unknown.length === answer.lines.length ? (
        <p className="da-big">
          <span className="da-mark-word">
            <span className="da-dashed" aria-hidden="true" />
            {t('decisionAnswer.notKnownIfAll')}
          </span>
        </p>
      ) : (
        <p className="da-big">
          <UpMark />
          <span className="da-big-words">
            <Figured
              text={t('decisionAnswer.rise', { amount: money(answer.potential.delta) })}
              figures={[money(answer.potential.delta)]}
            />
          </span>
        </p>
      )}
      {unknown.length > 0 ? (
        <p className="da-line is-strong">
          {t('decisionAnswer.fullNotKnown', { count: unknown.length })}
        </p>
      ) : (
        <p className="da-line">
          <Figured
            text={t('decisionAnswer.upperOnly', {
              upper: money(answer.potential.to),
              settled: money(answer.confirmed.to),
            })}
            figures={[money(answer.potential.to), money(answer.confirmed.to)]}
          />
        </p>
      )}
      <ul className="desk-rows da-rows">
        {rows.map((line) => (
          <li key={line.id}>
            <div className="desk-row da-row">
              {line.cost == null ? (
                <>
                  <RowWords title={line.label} lines={[t('decisionAnswer.notPricedYet')]} />
                  <span className="da-mark-word">
                    <span className="da-dashed" aria-hidden="true" />
                    {t('decisionAnswer.notKnown')}
                  </span>
                </>
              ) : (
                <>
                  <RowWords
                    title={line.label}
                    lines={[
                      <Figured
                        key="moved"
                        text={t('decisionAnswer.moved', {
                          from: money(line.cost.potential.from),
                          to: money(line.cost.potential.to),
                          headsFrom: line.quantity.potential.from,
                          headsTo: line.quantity.potential.to,
                        })}
                        figures={[money(line.cost.potential.from), money(line.cost.potential.to)]}
                      />,
                    ]}
                  />
                  <span className="da-amount">
                    <Figured
                      text={t('decisionAnswer.plus', { amount: money(line.cost.potential.delta) })}
                      figures={[money(line.cost.potential.delta)]}
                    />
                  </span>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** A sentence whose figures break only between digit groups (sc-72618): a group never splits, nor leaves its sign or code. */
function Figured({ text, figures }: { text: string; figures: readonly string[] }) {
  const out: ReactNode[] = [];
  let rest = text;

  for (let next = firstOf(rest, figures); next != null; next = firstOf(rest, figures)) {
    const { found, figure } = next;
    const at = found > 0 && '+−'.includes(rest[found - 1] ?? '') ? found - 1 : found;
    out.push(rest.slice(0, at));
    out.push(
      <span key={out.length} className="da-figure">
        {figureGroups(rest.slice(at, found + figure.length)).map((group, part) => (
          <Fragment key={part}>
            {part > 0 && <wbr />}
            <span className="da-group">{group}</span>
          </Fragment>
        ))}
      </span>,
    );
    rest = rest.slice(found + figure.length);
  }
  out.push(rest);

  return <>{out}</>;
}

/** Whichever figure comes first, the longer at a tie, so a language may order its placeholders as it needs. */
function firstOf(text: string, figures: readonly string[]) {
  let first: { found: number; figure: string } | undefined;
  for (const figure of figures) {
    const found = figure === '' ? -1 : text.indexOf(figure);
    if (found < 0) continue;
    if (
      first == null ||
      found < first.found ||
      (found === first.found && figure.length > first.figure.length)
    )
      first = { found, figure };
  }
  return first;
}

/** An up arrow, drawn here as the board draws it: the product's icon set has none. */
function UpMark() {
  return (
    <svg
      className="da-up"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}
