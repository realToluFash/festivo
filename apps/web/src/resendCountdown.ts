import { formatCountdown } from '@soirely/domain';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { offButton } from './offButton.ts';
import { useOneAtATime } from './oneAtATime.ts';

/** A resend button that counts down once it is off: its label is read once, from the time it starts at, only after a click (sc-11487). */
export function useResendCountdown(
  wording: { resend: string; resendIn: string },
  opening = 0,
): {
  cooldown: number;
  begin: (seconds: number) => void;
  countDown: (seconds: number) => void;
  once: (request: () => Promise<void>) => Promise<void>;
  button: ReturnType<typeof offButton>;
  label: string;
  status: string;
} {
  const { t } = useTranslation();
  const [cooldown, setCooldown] = useState(opening);
  const [said, setSaid] = useState('');
  const once = useOneAtATime();

  useEffect(() => {
    if (cooldown <= 0) return;

    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [cooldown]);

  return {
    cooldown,
    begin: setCooldown,
    countDown: (seconds) => {
      setCooldown(seconds);
      setSaid(t(wording.resendIn, { time: formatCountdown(seconds) }));
    },
    once,
    button: offButton(cooldown > 0),
    label:
      cooldown > 0 ? t(wording.resendIn, { time: formatCountdown(cooldown) }) : t(wording.resend),
    status: cooldown > 0 ? said : '',
  };
}
