import { useId, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { GuestField } from './GuestsParts.tsx';
import {
  GN,
  GROUP_CODES,
  NEED_GROUPS,
  NOTE_MOST,
  type NeedGroup,
  type Needs,
  type NeedsLines,
  chipsOf,
  codeName,
  lengthOf,
  toggled,
} from './guestNeeds.ts';
import { GW } from './guestsWords.ts';
import './guestNeeds.css';

/** The allergy mark: a ring with "!", always beside the word Allergy, never colour alone. */
function AllergyMark() {
  return (
    <span className="gn-mark" aria-hidden="true">
      !
    </span>
  );
}

function Chips({ needs }: { needs: Needs }) {
  return (
    <ul className="gn-chips">
      {chipsOf(needs).map((chip) => (
        <li key={chip.key} className={chip.allergy ? 'gn-chip is-allergy' : 'gn-chip'}>
          {chip.allergy && <AllergyMark />}
          {chip.allergy ? `${GN.allergy} · ${chip.words}` : chip.words}
        </li>
      ))}
    </ul>
  );
}

function Group({
  who,
  group,
  needs,
  error,
  onChange,
}: {
  who: string;
  group: NeedGroup;
  needs: Needs;
  error: string | undefined;
  onChange: (needs: Needs) => void;
}) {
  const id = useId();
  const codes = needs[group] as readonly string[];
  const other = needs.other[group];

  return (
    <fieldset className="gs-fieldset gn-group" aria-describedby={`${id}-hint`}>
      <legend className="gn-legend">
        {GN.groups[group]}
        {group === 'allergies' && (
          <span className="gn-first">
            <AllergyMark />
            {GN.shownFirst}
          </span>
        )}
      </legend>
      <p id={`${id}-hint`} className="desk-help">
        {GN.hints[group]}
      </p>
      <div className="gn-boxes">
        {GROUP_CODES[group].map((code) => (
          <label key={code} className="gs-tick gn-tick">
            <input
              type="checkbox"
              className="gs-box"
              checked={codes.includes(code)}
              data-focus={`${who}-${group}-${code}`}
              onChange={() => onChange(toggled(needs, group, code))}
            />
            {codeName(group, code)}
          </label>
        ))}
        <label className="gs-tick gn-tick">
          <input
            type="checkbox"
            className="gs-box"
            checked={other != null}
            data-focus={`${who}-${group}-tick`}
            onChange={() =>
              onChange({ ...needs, other: { ...needs.other, [group]: other == null ? '' : null } })
            }
          />
          {GN.other[group]}
        </label>
      </div>
      {other != null && (
        <GuestField
          label={GN.which[group]}
          value={other}
          error={error}
          focusKey={`${who}-${group}`}
          autoComplete="off"
          onChange={(words) => onChange({ ...needs, other: { ...needs.other, [group]: words } })}
        />
      )}
    </fieldset>
  );
}

function NoteField({
  who,
  value,
  error,
  onChange,
}: {
  who: string;
  value: string;
  error: string | undefined;
  onChange: (note: string) => void;
}) {
  const id = useId();
  const told = [`${id}-help`, `${id}-counter`, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label gs-label">
        {GN.privateNote}
        <span className="gs-optional">{GW.optional}</span>
      </label>
      <textarea
        id={id}
        className={error == null ? 'gn-note' : 'gn-note is-wrong'}
        value={value}
        rows={3}
        spellCheck
        data-focus={`${who}-note`}
        aria-invalid={error != null}
        aria-describedby={told}
        onChange={(event) => onChange(event.target.value)}
      />
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
      <p id={`${id}-help`} className="desk-help">
        {GN.noteHint}
      </p>
      <p id={`${id}-counter`} className="desk-help gn-count">
        {GW.ofMost(lengthOf(value), NOTE_MOST)}
      </p>
    </div>
  );
}

/** sc-3777's Needs, on Add guest and Edit guest and under each companion: collapsed to chips, open to three fieldsets and the note; a refusal opens it. */
export function NeedsSection({
  who,
  title,
  needs,
  lines,
  open: startOpen = false,
  onChange,
}: {
  who: string;
  title: string;
  needs: Needs;
  lines: NeedsLines | undefined;
  open?: boolean;
  onChange: (needs: Needs) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(startOpen);
  const refused = lines != null && Object.keys(lines).length > 0;
  const shown = open || refused;

  if (refused && !open) setOpen(true);
  const count = chipsOf(needs).length;

  return (
    <section className="gn" aria-labelledby={`${id}-head`}>
      <h3 className="gn-h">
        <button
          type="button"
          id={`${id}-head`}
          className="gn-head"
          aria-expanded={shown}
          aria-controls={`${id}-body`}
          data-focus={`${who}-head`}
          onClick={() => setOpen(!shown)}
        >
          <span className="gn-title">{title}</span>
          <span className="gn-noted">{count === 0 ? GN.noneRecorded : GN.noted(count)}</span>
          <Glyph name={shown ? 'chevup' : 'chevdown'} size={18} weight={2.3} />
        </button>
      </h3>
      <div id={`${id}-body`} className="gn-body">
        {!shown && count === 0 && <p className="desk-note">{GN.emptyLine}</p>}
        {!shown && count > 0 && <Chips needs={needs} />}
        {shown && (
          <>
            {NEED_GROUPS.map((group) => (
              <Group
                key={group}
                who={who}
                group={group}
                needs={needs}
                error={lines?.[group]}
                onChange={onChange}
              />
            ))}
            <NoteField
              who={who}
              value={needs.note}
              error={lines?.note}
              onChange={(note) => onChange({ ...needs, note })}
            />
          </>
        )}
      </div>
    </section>
  );
}
