import { useId } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import type { Allergen } from './guestKitchenWords.ts';
import {
  ACCESS_PICKS,
  ALLERGENS,
  type AccessPick,
  DIET_PICKS,
  type DietPick,
  NW,
  type Needs,
  type NeedsLines,
  lengthOf,
  needsChips,
} from './guestNeeds.ts';
import { GW } from './guestsWords.ts';

type OtherKey = 'otherAllergy' | 'otherDiet' | 'otherAccess';

/** The red-outlined Allergy mark: the word and the mark, never colour alone. */
export function AllergyMark() {
  return (
    <span className="gs-allergy">
      <Glyph name="alert" size={13} weight={2.4} />
      {NW.allergy}
    </span>
  );
}

function Refusal({ id, words }: { id: string; words: string }) {
  return (
    <p id={id} className="desk-error">
      <Glyph name="alert" size={15} weight={2.2} />
      {words}
    </p>
  );
}

function OtherField({
  label,
  value,
  error,
  focusKey,
  onChange,
}: {
  label: string;
  value: string;
  error: string | undefined;
  focusKey: string;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="desk-field gs-other">
      <label htmlFor={id} className="desk-label gs-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={id}
          type="text"
          value={value}
          spellCheck={false}
          autoComplete="off"
          data-focus={focusKey}
          aria-invalid={error != null}
          aria-describedby={error == null ? undefined : `${id}-error`}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error != null && <Refusal id={`${id}-error`} words={error} />}
    </div>
  );
}

function Group<T extends string>({
  legend,
  hint,
  first = false,
  codes,
  picked,
  nameOf,
  other,
  otherKey,
  otherLabel,
  error,
  focusKey,
  onPick,
  onOther,
}: {
  legend: string;
  hint: string;
  first?: boolean;
  codes: readonly T[];
  picked: readonly T[];
  nameOf: (code: T) => string;
  other: string;
  otherKey: OtherKey;
  otherLabel: string;
  error: string | undefined;
  focusKey: string;
  onPick: (picked: readonly T[]) => void;
  onOther: (value: string) => void;
}) {
  const hintId = useId();

  return (
    <fieldset className="gs-fieldset gs-needs-group" aria-describedby={hintId}>
      <legend className="gs-legend gs-needs-legend">
        {legend}
        {first && <span className="gs-first">{NW.shownFirst}</span>}
      </legend>
      <p id={hintId} className="desk-help">
        {hint}
      </p>
      <div className="gs-needs-grid">
        {codes.map((code) => (
          <label key={code} className="gs-tick gs-need">
            <input
              type="checkbox"
              className="gs-box"
              checked={picked.includes(code)}
              data-focus={code === 'other' ? `${focusKey}-${otherKey}-box` : undefined}
              onChange={() =>
                onPick(
                  picked.includes(code)
                    ? picked.filter((one) => one !== code)
                    : codes.filter((one) => one === code || picked.includes(one)),
                )
              }
            />
            {nameOf(code)}
          </label>
        ))}
      </div>
      {picked.includes('other' as T) && (
        <OtherField
          label={otherLabel}
          value={other}
          error={error}
          focusKey={`${focusKey}-${otherKey}`}
          onChange={onOther}
        />
      )}
    </fieldset>
  );
}

/** sc-3777's Needs on Add and Edit, and Their needs under each companion: a disclosure, its chips when closed. */
export function NeedsSection({
  title,
  needs,
  lines,
  open,
  focusKey,
  onOpen,
  onChange,
}: {
  title: string;
  needs: Needs;
  lines: NeedsLines;
  open: boolean;
  focusKey: string;
  onOpen: (open: boolean) => void;
  onChange: (needs: Needs) => void;
}) {
  const id = useId();
  const chips = needsChips(needs);
  const noteId = useId();
  const change = (next: Partial<Needs>) => onChange({ ...needs, ...next });

  return (
    <section className="gs-needs" aria-labelledby={`${id}-head`}>
      <h3 id={`${id}-head`} className="gs-needs-head">
        <button
          type="button"
          className="gs-disclose"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          data-focus={`${focusKey}-toggle`}
          onClick={() => onOpen(!open)}
        >
          <Glyph name={open ? 'chevup' : 'chevdown'} size={16} weight={2.4} />
          <span className="gs-disclose-title">{title}</span>
          <span className="gs-disclose-count">
            {chips.length === 0 ? NW.noneRecorded : NW.noted(chips.length)}
          </span>
        </button>
      </h3>
      {!open &&
        (chips.length === 0 ? (
          <p className="desk-help">{NW.noneRecordedLine}</p>
        ) : (
          <ul className="gs-need-chips">
            {chips.map((chip) => (
              <li
                key={`${chip.kind}:${chip.word}`}
                className={chip.kind === 'allergy' ? 'gs-need-chip is-allergy' : 'gs-need-chip'}
              >
                {chip.kind === 'allergy' && <Glyph name="alert" size={13} weight={2.4} />}
                {chip.word}
              </li>
            ))}
          </ul>
        ))}
      <div id={`${id}-body`} className="gs-needs-body" hidden={!open}>
        {open && (
          <>
            <Group<Allergen>
              legend={NW.allergies}
              hint={NW.allergiesHint}
              first
              codes={ALLERGENS}
              picked={needs.allergies}
              nameOf={NW.allergen}
              other={needs.otherAllergy}
              otherKey="otherAllergy"
              otherLabel={NW.whichAllergy}
              error={lines.otherAllergy}
              focusKey={focusKey}
              onPick={(allergies) => change({ allergies })}
              onOther={(otherAllergy) => change({ otherAllergy })}
            />
            <Group<DietPick>
              legend={NW.diet}
              hint={NW.dietHint}
              codes={DIET_PICKS}
              picked={needs.diet}
              nameOf={NW.dietName}
              other={needs.otherDiet}
              otherKey="otherDiet"
              otherLabel={NW.whichDiet}
              error={lines.otherDiet}
              focusKey={focusKey}
              onPick={(diet) => change({ diet })}
              onOther={(otherDiet) => change({ otherDiet })}
            />
            <Group<AccessPick>
              legend={NW.access}
              hint={NW.accessHint}
              codes={ACCESS_PICKS}
              picked={needs.access}
              nameOf={NW.accessName}
              other={needs.otherAccess}
              otherKey="otherAccess"
              otherLabel={NW.whatElse}
              error={lines.otherAccess}
              focusKey={focusKey}
              onPick={(access) => change({ access })}
              onOther={(otherAccess) => change({ otherAccess })}
            />
            <div className="desk-field">
              <label htmlFor={noteId} className="desk-label gs-label">
                {NW.privateNote}
                <span className="gs-optional">{GW.optional}</span>
              </label>
              <div className={lines.note == null ? 'desk-box' : 'desk-box is-wrong'}>
                <textarea
                  id={noteId}
                  className="gs-note"
                  rows={3}
                  value={needs.note}
                  data-focus={`${focusKey}-note`}
                  aria-invalid={lines.note != null}
                  aria-describedby={[
                    lines.note == null ? null : `${noteId}-error`,
                    `${noteId}-help`,
                    `${noteId}-count`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onChange={(event) => change({ note: event.target.value })}
                />
              </div>
              {lines.note != null && <Refusal id={`${noteId}-error`} words={lines.note} />}
              <p id={`${noteId}-help`} className="desk-help">
                {NW.noteHint}
              </p>
              <p id={`${noteId}-count`} className="desk-help" aria-live="polite">
                {NW.noteCount(lengthOf(needs.note))}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
