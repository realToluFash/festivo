import { LineIcon } from '../../components/AccountCard.tsx';
import { Row, RowList } from '../../components/Summary.tsx';
import { KS } from './wayIn.ts';

export interface TonightRow {
  line: string;
  onOpen: () => void;
}

export function stationItem(station: TonightRow, testID: string) {
  return {
    key: 'station',
    inset: 40,
    row: (
      <Row
        title={KS.title}
        line={station.line}
        lead={<LineIcon name="tablet" />}
        opens
        accessibilityLabel={KS.label(station.line)}
        onPress={station.onOpen}
        testID={testID}
      />
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
