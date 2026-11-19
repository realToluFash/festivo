import type { OrganisationEvent } from '@soirely/api-client';
import { type ReactNode, type RefObject, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { meshFor } from '../../../mesh.ts';

const PIECES = [1, 2, 3, 4, 5, 6];

export function CoverCard({ event, children }: { event: OrganisationEvent; children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <section
      className={`ev-card today-cover bt-card is-${meshFor(event.id)}`}
      aria-label={t('budget.card')}
    >
      <span className="ev-scrim" aria-hidden="true" />
      {PIECES.map((piece) => (
        <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
      ))}
      <div className="ev-card-inner bt-card-inner">{children}</div>
    </section>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  sign,
  unit,
  help,
  error,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  sign: string;
  unit?: string;
  help?: string;
  error?: string | null;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const told = [
    unit == null ? null : `${id}-unit`,
    help == null ? null : `${id}-help`,
    error == null ? null : `${id}-error`,
  ]
    .filter(Boolean)
    .join(' ');

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
          aria-describedby={told === '' ? undefined : told}
          onChange={(event) => onChange(event.target.value)}
        />
        {unit != null && (
          <span id={`${id}-unit`} className="bt-unit">
            {unit}
          </span>
        )}
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
