import type { ReactNode } from 'react';

import './wrapAction.css';

/** A 320 page's column, 288 wide, drawn inside the desk shell; the dashed edge is the demo's, not the design's. */
export function At320({ children }: { children: ReactNode }) {
  return (
    <div className="wrap-at-320">
      <p className="wrap-at-320-says">Demo only: a 320 page’s column, 288 wide</p>
      {children}
    </div>
  );
}
