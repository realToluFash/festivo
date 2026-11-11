import { type Ref, useEffect, useState } from 'react';
import type { ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LEAD_INSET, LineIcon } from '../../components/AccountCard.tsx';
import { Skeleton } from '../../components/Skeleton.tsx';
import { Row, RowList, Section } from '../../components/Summary.tsx';
import { ZONE_HELD_MS } from './AccountModel.ts';

/** Seconds until a new code may be sent; an expired code starts with none to wait. */
export function useCountdown(
  seconds: number,
  waiting = true,
): { left: number; restart: () => void } {
  const [left, setLeft] = useState(waiting ? seconds : 0);
  const [round, setRound] = useState(waiting ? 1 : 0);

  useEffect(() => {
    if (round === 0) return undefined;
    const started = Date.now();
    const timer = setInterval(() => {
      const next = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(next);
      if (next === 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds, round]);

  return {
    left,
    restart: () => {
      setLeft(seconds);
      setRound((value) => value + 1);
    },
  };
}

/** True while the sample's zone list is held back, until it arrives ZONE_HELD_MS after the page opens. */
export function useZoneHeld(held: boolean): boolean {
  const [waiting, setWaiting] = useState(held);

  useEffect(() => {
    if (!held) return undefined;
    const timer = setTimeout(() => setWaiting(false), ZONE_HELD_MS);

    return () => clearTimeout(timer);
  }, [held]);

  return waiting;
}

/** About you while the zone list loads: the Time zone row is the one-row skeleton, with nothing to open (sc-27219). */
export function AboutZoneWaiting({
  name,
  nameRef,
  onName,
}: {
  name: string;
  nameRef: Ref<ViewInstance>;
  onName: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Section title={t('account.aboutYou')}>
      <RowList
        items={[
          {
            key: 'name',
            inset: LEAD_INSET,
            row: (
              <Row
                ref={nameRef}
                title={name}
                line={t('account.yourName')}
                lead={<LineIcon name="user" />}
                opens
                onPress={onName}
                testID="account.name"
              />
            ),
          },
          {
            key: 'zone',
            inset: LEAD_INSET,
            row: (
              <Skeleton words={t('pending.loading')} shape="rows" rowHeight={56} rows={1} inCard />
            ),
          },
        ]}
      />
    </Section>
  );
}
