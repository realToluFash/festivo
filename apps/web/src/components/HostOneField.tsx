import type { RefObject } from 'react';

import { Glyph } from './Glyph.tsx';

/** Host 1, asked of a draft with no host (sc-22143). */
export interface HostOne {
  label: string;
  value: string;
  /** Said in place of the help, as Host 1 left empty is. */
  wrong: string | null;
  help: string;
  onType: (typed: string) => void;
}

/** Host 1 in Make live's question; `${id}-help` describes the dialog too. */
export function HostOneField({
  id,
  host,
  field,
  readOnly,
  onGo,
}: {
  id: string;
  host: HostOne;
  field: RefObject<HTMLInputElement | null>;
  readOnly: boolean;
  onGo: () => void;
}) {
  const wrong = host.wrong != null;

  return (
    <div className="desk-field">
      <label htmlFor={`${id}-host`} className="desk-label">
        {host.label}
      </label>
      <div className={wrong ? 'desk-box is-wrong' : 'desk-box'}>
        <input
          ref={field}
          id={`${id}-host`}
          type="text"
          value={host.value}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-invalid={wrong}
          aria-describedby={`${id}-help`}
          readOnly={readOnly}
          onChange={(change) => host.onType(change.target.value.replaceAll(/[\r\n]+/gu, ' '))}
          onKeyDown={(key) => {
            if (key.key !== 'Enter' || key.nativeEvent.isComposing) return;
            key.preventDefault();
            onGo();
          }}
        />
      </div>
      {wrong ? (
        <p id={`${id}-help`} className="desk-error" role="alert">
          <Glyph name="alert" size={18} weight={2.2} />
          {host.wrong}
        </p>
      ) : (
        <p id={`${id}-help`} className="desk-help">
          {host.help}
        </p>
      )}
    </div>
  );
}
