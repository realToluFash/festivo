import { useRef } from 'react';

import { Glyph } from './Glyph.tsx';
import './EventsSearch.css';

/** A search box with its own clear disc: Escape or the disc empties it, and the disc hands focus back to the box. */
export function SearchField({
  label,
  clearLabel,
  value,
  off = false,
  describedBy,
  focusKey,
  onChange,
  onClear,
  onEnter,
}: {
  label: string;
  clearLabel: string;
  value: string;
  off?: boolean;
  describedBy?: string | undefined;
  focusKey?: string;
  onChange: (value: string) => void;
  onClear: (by: 'key' | 'button') => void;
  onEnter?: () => void;
}) {
  const field = useRef<HTMLInputElement>(null);

  return (
    <div className={off ? 'ev-field is-off' : 'ev-field'}>
      <Glyph name="search" size={18} weight={2.2} />
      <input
        ref={field}
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        readOnly={off}
        aria-disabled={off || undefined}
        aria-describedby={describedBy}
        spellCheck={false}
        data-focus={focusKey}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onEnter != null) {
            event.preventDefault();
            onEnter();
          } else if (event.key === 'Escape' && value !== '') {
            event.preventDefault();
            onClear('key');
          }
        }}
      />
      {value !== '' && !off && (
        <button
          type="button"
          className="ev-clear"
          aria-label={clearLabel}
          onClick={() => {
            onClear('button');
            field.current?.focus();
          }}
        >
          <span className="ev-clear-disc" aria-hidden="true">
            <Glyph name="clear" size={12} weight={3} />
          </span>
        </button>
      )}
    </div>
  );
}
