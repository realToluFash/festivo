import { initials } from '@soirely/domain';
import type { KeyboardEventHandler, ReactNode, Ref } from 'react';

import { meshFor } from '../mesh.ts';
import { Glyph } from './Glyph.tsx';
import './desk.css';

/** The desk sidebar's organisation pill: its colour tile, its name, the invitations waiting, and the menu it opens (Today-B-Web, page 29). */
export function OrgPill({
  ref,
  id,
  name,
  label,
  waiting = null,
  open,
  overTile = null,
  onClick,
  onKeyDown,
}: {
  ref?: Ref<HTMLButtonElement>;
  id: string;
  name: string;
  label: string;
  waiting?: string | null;
  open: boolean;
  /** Laid over the tile, as a new organisation's colour arriving over the Create tile it came from. */
  overTile?: ReactNode;
  onClick: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className={`today-org sw-opener${waiting != null ? ' is-waiting' : ''}${open ? ' is-open' : ''}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={label}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span className={`sw-tile today-cover is-${meshFor(id)}`} aria-hidden="true">
        {initials(name)}
        {overTile}
      </span>
      <span className="sw-opener-words">
        <span className="sw-opener-name" title={name}>
          {name}
        </span>
        {waiting != null && (
          <span className="sw-opener-waiting">
            <span className="sw-ring" aria-hidden="true" />
            {waiting}
          </span>
        )}
      </span>
      <Glyph name="updown" size={15} />
    </button>
  );
}
