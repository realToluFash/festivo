import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { LineIcon } from '../../components/AccountCard.tsx';
import { Row, RowList } from '../../components/Summary.tsx';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { KS } from './wayIn.ts';

export interface TonightRow {
  line: string;
  onOpen: () => void;
  /** Arrives once the stations read answers: a fade over motionBase, none under Reduce motion. */
  fades?: boolean;
}

function FadeIn({ on, children }: { on: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(on && !reduced ? 0 : 1));

  useEffect(() => {
    if (!on || reduced) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: tokens.motionBase,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [on, reduced, opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

export function stationItem(station: TonightRow, testID: string) {
  return {
    key: 'station',
    inset: 40,
    row: (
      <FadeIn on={station.fades === true}>
        <Row
          title={KS.title}
          line={station.line}
          lead={<LineIcon name="tablet" />}
          opens
          accessibilityLabel={KS.label(station.line)}
          onPress={station.onOpen}
          testID={testID}
        />
      </FadeIn>
    ),
  };
}

/** The organiser's Overview: Your night, then Kitchen station under it or in its place (sc-3915, sc-95382). */
export function TonightRows({
  night,
  station,
}: {
  night: TonightRow | undefined;
  station: TonightRow | undefined;
}) {
  if (night == null && station == null) return null;

  return (
    <RowList
      items={[
        ...(night == null
          ? []
          : [
              {
                key: 'night',
                inset: 40,
                row: (
                  <Row
                    title={KS.yourNight}
                    line={night.line}
                    lead={<LineIcon name="clock" />}
                    opens
                    onPress={night.onOpen}
                    testID="event.yourNight"
                  />
                ),
              },
            ]),
        ...(station == null ? [] : [stationItem(station, 'event.station')]),
      ]}
    />
  );
}
