import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { LineIcon } from '../../components/AccountCard.tsx';
import { type GlyphName } from '../../components/Glyph.tsx';
import { Row, RowList } from '../../components/Summary.tsx';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { FL } from '../floor/floorWayIn.ts';
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

function serviceItem(key: string, title: string, icon: GlyphName, label: (line: string) => string) {
  return (row: TonightRow, testID: string) => ({
    key,
    inset: 40,
    row: (
      <FadeIn on={row.fades === true}>
        <Row
          title={title}
          line={row.line}
          lead={<LineIcon name={icon} />}
          opens
          accessibilityLabel={label(row.line)}
          onPress={row.onOpen}
          testID={testID}
        />
      </FadeIn>
    ),
  });
}

export const stationItem = serviceItem('station', KS.title, 'tablet', KS.label);

/** Floor (sc-98893): directly under Kitchen station where it shows, else under Your night, else first. */
export const floorItem = serviceItem('floor', FL.title, 'seating', FL.label);

/** The organiser's Overview: Your night, then Kitchen station and Floor under it or in its place (sc-3915, sc-95382, sc-98893). */
export function TonightRows({
  night,
  station,
  floor,
}: {
  night: TonightRow | undefined;
  station: TonightRow | undefined;
  floor?: TonightRow | undefined;
}) {
  if (night == null && station == null && floor == null) return null;

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
        ...(floor == null ? [] : [floorItem(floor, 'event.floor')]),
      ]}
    />
  );
}
