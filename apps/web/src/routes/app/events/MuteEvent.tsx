import { JustForYou } from '../../../components/JustForYou.tsx';
import { useEventMute } from '../../../components/MuteSwitch.tsx';

/** `MuteEvent-*` (sc-3980): per person, the same mute as the bell's More, as Just for you. */
export function MuteEvent({ eventId }: { eventId: string }) {
  const { mute, saving, change, retry } = useEventMute(eventId);

  return (
    <JustForYou
      muted={mute.status === 'loaded' && mute.muted}
      loaded={mute.status !== 'failed'}
      failed={mute.status === 'loaded' && mute.unsaved}
      busy={saving || mute.status === 'loading'}
      settings="/app/account/notifications"
      onRetry={retry}
      onChange={(next) => void change(next)}
    />
  );
}
