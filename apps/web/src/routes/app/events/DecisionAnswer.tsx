import { type WhatIf } from '@soirely/api-client';
import { minorDigits, numberFormat } from '@soirely/domain';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { RowWords } from '../../../components/SettingsParts.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { type Asked } from './whatAddingCosts.ts';
import './decisionAnswer.css';

/** Whole units; a change under one unit in the minor unit, so a rise never reads +£0 (pm, 7 Nov). */
function shown(amount: string, currency: string, locale: string): string {
  const value = Number(amount);
  const digits = value !== 0 && Math.abs(value) < 1 ? minorDigits(currency) : 0;

  return numberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

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
  const money = (amount: string) => shown(amount, answer.currency, locale);
  const unknown = answer.lines.filter((line) => !line.known);

  if (answer.lines.length === 0)
    return (
      <>
        <p className="da-big">{t('decisionAnswer.noChange')}</p>
        <p className="da-line">{t('decisionAnswer.nothingPerGuest')}</p>
      </>
    );

  return (
    <>
      <p className="da-big">
        <UpMark />
        {t('decisionAnswer.rise', { amount: money(answer.potential.delta) })}
      </p>
      {unknown.length > 0 ? (
        <p className="da-line is-strong">
          {t('decisionAnswer.fullNotKnown', { count: unknown.length })}
        </p>
      ) : (
        <p className="da-line">
          {t('decisionAnswer.upperOnly', {
            total: money(answer.potential.to),
            settled: money(answer.confirmed.to),
          })}
        </p>
      )}
      <ul className="desk-rows da-rows">
        {answer.lines.map((line) => (
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
                      t('decisionAnswer.moved', {
                        from: money(line.cost.potential.from),
                        to: money(line.cost.potential.to),
                        headsFrom: line.quantity.potential.from,
                        headsTo: line.quantity.potential.to,
                      }),
                    ]}
                  />
                  <span className="da-amount">
                    {t('decisionAnswer.plus', { amount: money(line.cost.potential.delta) })}
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
