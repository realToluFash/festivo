import { type OrganisationEvent } from '@soirely/api-client';
import { useState } from 'react';

import { api } from '../api.ts';

type Confirming<C> = { kind: 'confirm'; pending: boolean; failed: boolean } & C;

export type Asking<C, R extends { kind: string }> = Confirming<C> | Exclude<R, { kind: 'failed' }>;

/** Every lifecycle move (Make live, Pause, Call off and End now) asks, calls, and on a refusal its sheet turns into the reason; `refusalOf` is the move's mapping in the kit, and `reloads` says which refusals read the event again. */
export function useLifecycleAction<C extends object, R extends { kind: string }>({
  event,
  onChange,
  onDone,
  refusalOf,
  reloads = () => true,
}: {
  event: OrganisationEvent;
  onChange: (event: OrganisationEvent) => void;
  onDone?: () => void;
  refusalOf: (error: unknown) => R;
  reloads?: (refusal: Exclude<R, { kind: 'failed' }>) => boolean;
}) {
  const [asking, setAsking] = useState<Asking<C, R> | null>(null);
  const pending = asking?.kind === 'confirm' && (asking as Confirming<C>).pending;

  const confirming = (choice: C, busy: boolean, failed: boolean): Confirming<C> => ({
    ...choice,
    kind: 'confirm',
    pending: busy,
    failed,
  });

  const ask = (choice: C) => setAsking(confirming(choice, false, false));
  /** Opens refused, without asking first, when the event already says why. */
  const tell = (refusal: Exclude<R, { kind: 'failed' }>) => setAsking(refusal);
  const close = () => !pending && setAsking(null);

  const go = (choice: C, call: () => Promise<{ event: OrganisationEvent }>) => {
    setAsking(confirming(choice, true, false));
    call().then(
      ({ event: moved }) => {
        setAsking(null);
        onChange(moved);
        onDone?.();
      },
      (error: unknown) => {
        const refusal = refusalOf(error);

        if (refusal.kind === 'failed') {
          setAsking(confirming(choice, false, true));
          return;
        }

        const shown = refusal as Exclude<R, { kind: 'failed' }>;

        if (!reloads(shown)) {
          setAsking(shown);
          return;
        }

        api.event(event.id).then(
          (latest) => {
            onChange(latest);
            setAsking(shown);
          },
          () => setAsking(confirming(choice, false, true)),
        );
      },
    );
  };

  return { asking, pending, ask, tell, go, close };
}
