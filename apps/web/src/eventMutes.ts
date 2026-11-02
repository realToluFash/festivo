import type { EventMute } from '@soirely/api-client';
import { useEffect, useRef } from 'react';

type Listener = (eventId: string, mute: EventMute) => void;

const listeners = new Set<Listener>();

/** Every Mute this event switch says when a change saved, so an open bell follows one on the event's page too. */
export function announceMute(eventId: string, mute: EventMute): void {
  listeners.forEach((listener) => listener(eventId, mute));
}

export function useMutes(onMute: Listener): void {
  const latest = useRef(onMute);

  useEffect(() => {
    latest.current = onMute;
  });

  useEffect(() => {
    const listener: Listener = (eventId, mute) => latest.current(eventId, mute);
    listeners.add(listener);

    return () => void listeners.delete(listener);
  }, []);
}
