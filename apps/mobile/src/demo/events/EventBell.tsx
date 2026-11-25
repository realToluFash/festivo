import { type Href, router } from 'expo-router';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import type { ViewInstance } from 'react-native';

import type { Anchor } from '../../components/Summary.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { measuredUnder } from '../measuredUnder.ts';
import { openOnceSettled } from '../menuSettles.ts';
import { BellPlace } from '../messages/BellPlace.tsx';
import { SAMPLE_EVENT_ID } from '../messages/MessagesSample.ts';
import { bellHref } from './opener.ts';

const MENU_AFTER_MS = 300;

/** The bell over an event's page on an iPad (sc-84453): a notification for another event pushes it over this page, so its ‹ reads Event and goes back here as it was left; one for this event opens no second page, and this page shows the area it names. */
export function useEventBell({
  eventId,
  startOpen,
  onHere,
}: {
  eventId: string;
  startOpen: boolean;
  onHere: (key: string) => void;
}): { onBell?: () => void; bellRef?: RefObject<ViewInstance | null>; place: ReactNode } {
  const shell = useShell();
  const tablet = shell.layout !== 'phone';
  const bellRef = useRef<ViewInstance>(null);
  const [open, setOpen] = useState(tablet && startOpen);
  const [at, setAt] = useState<Anchor | null>(null);
  const [allRead, setAllRead] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    return openOnceSettled(measuredUnder(bellRef), setAt, MENU_AFTER_MS);
  }, [open]);

  if (!tablet) return { place: null };

  return {
    onBell: () => setOpen(true),
    bellRef,
    place: (
      <BellPlace
        open={open}
        phone={false}
        at={open ? at : null}
        opener={bellRef}
        push={false}
        state="bell"
        allRead={allRead}
        onAllRead={() => setAllRead(true)}
        onClose={() => setOpen(false)}
        onSettings={() => shell.openSection('notifications')}
        onItem={(key) => {
          setOpen(false);
          if (key === 'security') shell.openSection('security');
          else if (eventId === SAMPLE_EVENT_ID) onHere(key);
          else router.push(bellHref(key) as Href);
        }}
      />
    ),
  };
}
