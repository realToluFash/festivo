import { type ReactNode, type Ref, type RefObject, useId } from 'react';

import { Broken } from './EventPageParts.tsx';
import { Glyph } from './Glyph.tsx';
import { Head } from './SettingsParts.tsx';
import './eventForm.css';

/** A list to choose from at a desk; held, it still takes focus and reads its value, and only takes no change (sc-11588). */
export function Select({
  id: given,
  refTo,
  label,
  value,
  placeholder,
  choices,
  error,
  help,
  off = false,
  onChange,
}: {
  id?: string;
  refTo?: RefObject<HTMLDivElement | null> | undefined;
  label: string;
  value: string;
  placeholder?: string | undefined;
  choices: readonly (readonly [string, string])[];
  error?: string | undefined;
  help?: string | undefined;
  off?: boolean;
  onChange: (value: string) => void;
}) {
  const made = useId();
  const id = given ?? made;
  const told = [error == null ? null : `${id}-error`, help == null ? null : `${id}-help`]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={refTo} className="desk-field">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box ev-select' : 'desk-box ev-select is-wrong'}>
        <select
          id={id}
          value={value}
          aria-disabled={off || undefined}
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          className={value === '' ? 'is-empty' : undefined}
          onChange={(change) => {
            if (!off) onChange(change.target.value);
          }}
        >
          {placeholder != null && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {choices.map(([one, words]) => (
            <option key={one} value={one}>
              {words}
            </option>
          ))}
        </select>
        <Glyph name="chevdown" size={18} weight={2.3} />
      </div>
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
    </div>
  );
}

/** One of New event's headed blocks, in the form's order (sc-48607). */
export function FormBlock({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();

  return (
    <section className="desk-block ev-new-block" aria-labelledby={id}>
      <Head title={<span id={id}>{title}</span>} />
      <div className="ev-new-fields">{children}</div>
    </section>
  );
}

/** The cover as it will show: the photo, or Soirely's cover in the event's own colours. */
export function CoverPreview({
  photo,
  mesh,
  className = '',
}: {
  photo: ReactNode | null;
  mesh: string;
  className?: string;
}) {
  return (
    <div
      className={`ev-preview ${className} ${photo != null ? 'is-photo' : `today-cover is-${mesh}`}`}
      aria-hidden="true"
    >
      <span className="ev-scrim" />
      {photo ??
        [1, 2, 3, 4, 5, 6].map((piece) => <span key={piece} className={`desk-piece p${piece}`} />)}
    </div>
  );
}

/** With no photo yet: what the cover is, Upload (gone while held), and what is accepted. */
export function CoverUpload({
  words,
  refusal = null,
  off = false,
  buttonRef,
  onUpload,
}: {
  words: { line: string; upload: string; accepted: string };
  refusal?: string | null;
  off?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  onUpload: () => void;
}) {
  return (
    <>
      {refusal != null ? <Broken>{refusal}</Broken> : <p className="desk-line">{words.line}</p>}
      {!off && (
        <button ref={buttonRef} type="button" className="ev-upload" onClick={onUpload}>
          <Glyph name="photo" size={19} weight={2.2} />
          {words.upload}
        </button>
      )}
      <p className="desk-help">{words.accepted}</p>
    </>
  );
}
