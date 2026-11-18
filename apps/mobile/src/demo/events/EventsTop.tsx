import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ListTop } from '../../components/ListTop.tsx';
import { Pill } from '../../components/SettingsParts.tsx';
import { Title } from '../../components/Title.tsx';
import { TopPrimary, type TopPrimaryProps, usePrimaryLabel } from '../../components/TopPrimary.tsx';
import { TOP_TITLE, topTitle } from '../../components/topTitle.ts';
import { type LayoutKind } from '../../layout/classify.ts';
import { tokens } from '../../theme/tokens.ts';

interface EventsTopProps {
  kind: LayoutKind;
  title: string;
  pill: ReactNode;
  bell: ReactNode;
  primary?: TopPrimaryProps | undefined;
  under?: ReactNode;
}

/** Events' top as `ListTop` draws it, but + New event, where a tablet labels it, is as tall as its words at every text size (sc-67659). A phone draws the round +, so it keeps `ListTop`. */
export function EventsTop(props: EventsTopProps) {
  if (props.kind === 'phone' || props.primary == null) return <ListTop {...props} />;

  const { label, onPress, testID } = props.primary;

  return (
    <TabletTop
      kind={props.kind}
      title={props.title}
      bell={props.bell}
      under={props.under}
      label={label}
      onPress={onPress}
      testID={testID}
    />
  );
}

function TabletTop({
  kind,
  title,
  bell,
  under,
  label: primaryLabel,
  onPress,
  testID,
}: Pick<EventsTopProps, 'kind' | 'title' | 'bell' | 'under'> &
  Pick<TopPrimaryProps, 'label' | 'onPress' | 'testID'>) {
  // Measured at one line and 44 tall, as on main, so the words or the round + are chosen as sc-51444 chooses them.
  const label = usePrimaryLabel({
    title,
    size: TOP_TITLE,
    style: topTitle,
    label: primaryLabel,
    gap: tokens.spaceMd,
    labelled: true,
  });

  return (
    <View>
      <View style={styles.titleRow}>
        <View style={styles.fill} onLayout={label.onSlot}>
          {label.measure}
          <Title size={TOP_TITLE} accessibilityRole="header" style={topTitle}>
            {title}
          </Title>
        </View>
        {label.wide ? (
          <Pill
            label={primaryLabel}
            glyph="plus"
            height={tokens.sizeHit}
            full={false}
            grows
            onPress={onPress}
            testID={testID}
          />
        ) : (
          <TopPrimary label={primaryLabel} onPress={onPress} testID={testID} wide={false} />
        )}
        {kind === 'tabletLandscape' && bell}
      </View>
      {under}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  titleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
});
