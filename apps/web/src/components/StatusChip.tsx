import type { StatusLook } from '@soirely/domain';
import type { ReactNode } from 'react';

/** A state as a pill with a shape and its word, never colour alone (WCAG 2.2, 1.4.1). */
export function StatusChip({ look, children }: { look: StatusLook; children: ReactNode }) {
  return (
    <span className="pill-quiet status-chip" data-tone={look.tone} data-shape={look.shape}>
      {children}
    </span>
  );
}
