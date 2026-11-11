import type { ReactNode } from 'react';

import { tied } from './members.ts';
import './wrapAction.css';

/** sc-40153: RedAction whose label wraps whole, the organisation's name never cut; one that fits looks as today. */
export function WrapRedAction({
  label,
  line,
  onClick,
}: {
  label: string;
  line: string;
  onClick: () => void;
}) {
  const [head, tail] = tied(label);

  return (
    <div className="desk-red">
      <button
        type="button"
        className="desk-text is-red is-wraps"
        aria-label={label}
        onClick={onClick}
      >
        {head}
        <span className="wrap-tied">{tail}</span>
      </button>
      <p className="desk-note">{line}</p>
    </div>
  );
}

/** A 320 page's column, 288 wide, drawn inside the desk shell; the dashed edge is the demo's, not the design's. */
export function At320({ children }: { children: ReactNode }) {
  return (
    <div className="wrap-at-320">
      <p className="wrap-at-320-says">Demo only: a 320 page’s column, 288 wide</p>
      {children}
    </div>
  );
}
