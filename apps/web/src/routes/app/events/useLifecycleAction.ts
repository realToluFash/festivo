import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { type RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { NOW_STATE } from './eventWords.ts';

export type Confirming<C> = { kind: 'confirm'; pending: boolean; failed: boolean } & C;

/** What a refusal says once the dialog has turned into one: a title, its lines, and Close. */
export interface Refused {
  kind: 'refused';
  title: string;
  lines: string[];
}

export type Asking<C> = Confirming<C> | Refused;

/** `reload` reads the event again before `then` words the refusal, so the page shows what it is now. */
export interface Refusal {
  reload: boolean;
  then: (latest: OrganisationEvent) => Omit<Refused, 'kind'>;
}

/** Every lifecycle move (Make live, Pause, Call off and End now) asks, calls, and on a refusal turns its dialog into the reason. `event_state_invalid` is always "Changed elsewhere"; `refusalOf` adds the move's own. */
export function useLifecycleAction<C extends object>({
  event,
  heading,
  onChange,
  onDone,
  refusalOf = () => null,
}: {
  event: OrganisationEvent;
  heading: RefObject<HTMLHeadingElement | null>;
  onChange: (event: OrganisationEvent) => void;
  onDone: () => void;
  refusalOf?: (error: ApiError) => Refusal | null;
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState<Asking<C> | null>(null);
  const opener = useRef<HTMLButtonElement>(null);

  const confirming = (choice: C, pending: boolean, failed: boolean): Confirming<C> => ({
    ...choice,
    kind: 'confirm',
    pending,
    failed,
  });

  const changed: Refusal = {
    reload: true,
    then: (latest) => ({
      title: t('eventLive.changedElsewhere'),
      lines: [t(NOW_STATE[latest.status])],
    }),
  };

  const ask = (choice: C) => setAsking(confirming(choice, false, false));

  const close = () => {
    setAsking(null);
    window.setTimeout(() => (opener.current ?? heading.current)?.focus(), 0);
  };

  const go = (choice: C, call: () => Promise<{ event: OrganisationEvent }>) => {
    setAsking(confirming(choice, true, false));
    call().then(
      ({ event: moved }) => {
        setAsking(null);
        onChange(moved);
        onDone();
        window.setTimeout(() => heading.current?.focus(), 0);
      },
      (error: unknown) => {
        const refusal = !(error instanceof ApiError)
          ? null
          : error.is('event_state_invalid')
            ? changed
            : refusalOf(error);

        if (refusal == null) {
          setAsking(confirming(choice, false, true));
        } else if (!refusal.reload) {
          setAsking({ kind: 'refused', ...refusal.then(event) });
        } else {
          void api.event(event.id).then(
            (latest) => {
              onChange(latest);
              setAsking({ kind: 'refused', ...refusal.then(latest) });
            },
            () => setAsking(confirming(choice, false, true)),
          );
        }
      },
    );
  };

  return { asking, opener, ask, go, close };
}
