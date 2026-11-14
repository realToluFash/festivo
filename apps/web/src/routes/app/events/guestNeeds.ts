import { type NeedsProblems } from '@soirely/domain';
import { useState } from 'react';

/** Which Needs sections are open, `guest` or `c{n}`; a refusal opens every one that failed. */
export function useNeedsOpen() {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  return {
    open,
    toggle: (who: string, next: boolean) =>
      setOpen((was) => {
        const after = new Set(was);

        if (next) after.add(who);
        else after.delete(who);

        return after;
      }),
    openFailing: (problems: Record<string, NeedsProblems>) =>
      setOpen((was) => new Set([...was, ...Object.keys(problems)])),
    closeAll: () => setOpen(new Set()),
  };
}
