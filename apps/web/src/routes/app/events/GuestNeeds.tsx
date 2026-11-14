import {
  ACCESS_NEEDS,
  ALLERGENS,
  type AccessNeed,
  type Allergen,
  DIETS,
  type Diet,
  type GuestDetails,
  type GuestNeeds,
  NEED_NOTE_MAXIMUM,
} from '@soirely/api-client';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph, type GlyphName } from '../../../components/Glyph.tsx';
import { Head, RowWords } from '../../../components/SettingsParts.tsx';
import { FieldWrong } from './GuestFields.tsx';
import {
  type NeedsProblems,
  type NeedsTyped,
  needsFocusKey,
  accessNames,
  allergyNames,
  dietNames,
  lengthOf,
  needsChips,
  needsWords,
  recorded,
} from './guestNeeds.ts';

type OtherKey = 'otherAllergy' | 'otherDiet' | 'otherAccess';

/** The red-outlined Allergy mark: the word and the mark, never colour alone. */
export function AllergyMark() {
  const { t } = useTranslation();

  return (
    <span className="gs-allergy">
      <Glyph name="alert" size={13} weight={2.4} />
      {t('guestNeeds.allergy')}
    </span>
  );
}

/** sc-3777's line above a form a Needs field refused; the contact fields keep their own beside each. */
export function NeedsRefused({ count }: { count: number }) {
  const { t } = useTranslation();

  if (count === 0) return null;

  return (
    <p className="desk-error gs-refused" role="alert">
      <Glyph name="alert" size={15} weight={2.2} />
      {t('guestNeeds.toFix', { count })}
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
      {error != null && <FieldWrong id={`${id}-error`}>{error}</FieldWrong>}
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
  onPick: (picked: T[]) => void;
  onOther: (value: string) => void;
}) {
  const { t } = useTranslation();
  const hintId = useId();

  return (
    <fieldset className="gs-fieldset gs-needs-group" aria-describedby={hintId}>
      <legend className="gs-legend gs-needs-legend">
        {legend}
        {first && <span className="gs-first">{t('guestNeeds.shownFirst')}</span>}
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
  problems,
  open,
  focusKey,
  onOpen,
  onChange,
}: {
  title: string;
  needs: NeedsTyped;
  problems: NeedsProblems;
  open: boolean;
  focusKey: string;
  onOpen: (open: boolean) => void;
  onChange: (needs: NeedsTyped) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const noteId = useId();
  const chips = needsChips(t, needs);
  const change = (next: Partial<NeedsTyped>) => onChange({ ...needs, ...next });
  const noteError = needsWords(t, problems.note);

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
            {chips.length === 0
              ? t('guestNeeds.noneRecorded')
              : t('guestNeeds.noted', { count: chips.length })}
          </span>
        </button>
      </h3>
      {!open &&
        (chips.length === 0 ? (
          <p className="desk-help">{t('guestNeeds.noneRecordedLine')}</p>
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
              legend={t('guestNeeds.allergies')}
              hint={t('guestNeeds.allergiesHint')}
              first
              codes={ALLERGENS}
              picked={needs.allergies}
              nameOf={(code) => t(`guestNeeds.allergen.${code}`)}
              other={needs.otherAllergy}
              otherKey="otherAllergy"
              otherLabel={t('guestNeeds.whichAllergy')}
              error={needsWords(t, problems.otherAllergy)}
              focusKey={focusKey}
              onPick={(allergies) => change({ allergies })}
              onOther={(otherAllergy) => change({ otherAllergy })}
            />
            <Group<Diet>
              legend={t('guestNeeds.diet')}
              hint={t('guestNeeds.dietHint')}
              codes={DIETS}
              picked={needs.diet}
              nameOf={(code) => t(`guestNeeds.dietName.${code}`)}
              other={needs.otherDiet}
              otherKey="otherDiet"
              otherLabel={t('guestNeeds.whichDiet')}
              error={needsWords(t, problems.otherDiet)}
              focusKey={focusKey}
              onPick={(diet) => change({ diet })}
              onOther={(otherDiet) => change({ otherDiet })}
            />
            <Group<AccessNeed>
              legend={t('guestNeeds.access')}
              hint={t('guestNeeds.accessHint')}
              codes={ACCESS_NEEDS}
              picked={needs.access}
              nameOf={(code) => t(`guestNeeds.accessName.${code}`)}
              other={needs.otherAccess}
              otherKey="otherAccess"
              otherLabel={t('guestNeeds.whatElse')}
              error={needsWords(t, problems.otherAccess)}
              focusKey={focusKey}
              onPick={(access) => change({ access })}
              onOther={(otherAccess) => change({ otherAccess })}
            />
            <div className="desk-field">
              <label htmlFor={noteId} className="desk-label gs-label">
                {t('guestNeeds.privateNote')}
                <span className="gs-optional">{t('eventForm.optional')}</span>
              </label>
              <div className={noteError == null ? 'desk-box' : 'desk-box is-wrong'}>
                <textarea
                  id={noteId}
                  className="gs-note"
                  rows={3}
                  value={needs.note}
                  data-focus={`${focusKey}-note`}
                  aria-invalid={noteError != null}
                  aria-describedby={[
                    noteError == null ? null : `${noteId}-error`,
                    `${noteId}-help`,
                    `${noteId}-count`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onChange={(event) => change({ note: event.target.value })}
                />
              </div>
              {noteError != null && <FieldWrong id={`${noteId}-error`}>{noteError}</FieldWrong>}
              <p id={`${noteId}-help`} className="desk-help">
                {t('guestNeeds.noteHint')}
              </p>
              <p id={`${noteId}-count`} className="desk-help" aria-live="polite">
                {t('guestNeeds.noteCount', {
                  count: lengthOf(needs.note),
                  most: NEED_NOTE_MAXIMUM,
                })}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export interface CompanionNeeds {
  problems: Record<string, NeedsProblems>;
  open: ReadonlySet<string>;
  toggle: (who: string, open: boolean) => void;
}

/** Their needs, under a companion's name. */
export function CompanionNeedsSection({
  at,
  typed,
  needs,
  onChange,
}: {
  at: number;
  typed: NeedsTyped;
  needs: CompanionNeeds;
  onChange: (needs: NeedsTyped) => void;
}) {
  const { t } = useTranslation();
  const who = `c${at}`;

  return (
    <NeedsSection
      title={t('guestNeeds.theirNeeds')}
      needs={typed}
      problems={needs.problems[who] ?? {}}
      open={needs.open.has(who)}
      focusKey={needsFocusKey(who)}
      onOpen={(open) => needs.toggle(who, open)}
      onChange={onChange}
    />
  );
}

function IconLead({ name }: { name: GlyphName }) {
  return (
    <span className="gs-lead is-icon" aria-hidden="true">
      <Glyph name={name} size={20} weight={2} />
    </span>
  );
}

function NeedsRows({ needs }: { needs: GuestNeeds }) {
  const { t } = useTranslation();
  const rows = [
    {
      key: 'allergies',
      title: allergyNames(t, needs).join(', '),
      label: t('guestNeeds.allergies'),
    },
    { key: 'diet', title: dietNames(t, needs).join(', '), label: t('guestNeeds.diet') },
    { key: 'access', title: accessNames(t, needs).join(', '), label: t('guestNeeds.access') },
    { key: 'note', title: needs.note ?? '', label: t('guestNeeds.privateNote') },
  ].filter((row) => row.title !== '');

  return rows.map((row) => (
    <li key={row.key} className="desk-row">
      <IconLead name={row.key === 'allergies' ? 'alert' : row.key === 'note' ? 'lock' : 'info'} />
      <div className="gs-row-words">
        <RowWords title={row.title} lines={[row.label]} />
        {row.key === 'allergies' && <AllergyMark />}
      </div>
    </li>
  ));
}

/** sc-3777: allergies, diet and access under their own headings, the guest's then each companion's; for people who manage guests only. */
export function NeedsBlock({
  guest,
  heading,
  nameOf,
}: {
  guest: GuestDetails;
  heading: string;
  nameOf: (at: number) => string;
}) {
  const { t } = useTranslation();
  const companions = guest.companions.flatMap((one, at) =>
    recorded(one.needs) ? [{ id: one.id, at, needs: one.needs }] : [],
  );
  const none = !recorded(guest.needs) && companions.length === 0;

  return (
    <section className="desk-block" aria-labelledby={`${heading}-needs`}>
      <Head level={3} title={<span id={`${heading}-needs`}>{t('guestNeeds.needs')}</span>} />
      {none ? (
        <p className="desk-line">{t('guestNeeds.noDietary')}</p>
      ) : (
        <>
          {recorded(guest.needs) && (
            <ul className="desk-rows gs-rows">
              <NeedsRows needs={guest.needs} />
            </ul>
          )}
          {companions.map(({ id, at, needs }) => (
            <div key={id} className="gs-their-needs">
              <h4 className="gs-their-head">{nameOf(at)}</h4>
              <ul className="desk-rows gs-rows">
                <NeedsRows needs={needs} />
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
