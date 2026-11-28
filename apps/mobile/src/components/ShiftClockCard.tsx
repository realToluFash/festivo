import type { ShiftClockCard as Clock } from '@soirely/api-client';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { dateLocale } from '../i18n/index.ts';
import { clockAt } from '../kit/myNight.ts';
import { type ClockLine, hoursWords, lineWords, timeWords } from '../kit/shiftClock.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton } from './Buttons.tsx';
import { Notice } from './Notice.tsx';
import { ShapeMark } from './StatusMark.tsx';
import { Text } from './Text.tsx';

/** sc-234's clock card on a person's own night, as /demo/shift-clock draws it on the app; past their access it ends at the clock-out. */
export function ShiftClockCard({
  clock,
  past,
  line,
  said,
  busy,
  now,
  timeZone,
  onPress,
}: {
  clock: Clock;
  past: boolean;
  line: ClockLine;
  said: number;
  busy: boolean;
  now: Date;
  timeZone: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const at = (time: string | null) =>
    time == null ? '' : timeWords(t, time, now, timeZone, locale);
  const tapLine = (
    <TapLine line={line} words={lineWords(t, line, clock, now, timeZone, locale)} said={said} />
  );
  let body;

  if (clock.phase === 'before')
    body = (
      <>
        <PrimaryButton
          label={t('myNight.clockOpensAt', { time: clockAt(clock.opensAt, locale) })}
          onPress={() => undefined}
          off
          testID="myNight.clockOpens"
        />
        <Text size={17} style={styles.secondary}>
          {t('myNight.clockOpensLine')}
        </Text>
      </>
    );
  else if (clock.phase === 'ready')
    body = (
      <>
        {tapLine}
        <PrimaryButton
          label={busy ? t('shiftClock.clockingIn') : t('shiftClock.clockIn')}
          busy={busy}
          onPress={onPress}
          testID="myNight.clockIn"
        />
        <Text size={15} style={styles.secondary}>
          {t('shiftClock.readyLine')}
        </Text>
      </>
    );
  else if (clock.phase === 'on')
    body = (
      <>
        <StatusLine words={t('shiftClock.clockedInAt', { time: at(clock.clockedInAt) })} done />
        {tapLine}
        <PrimaryButton
          label={busy ? t('shiftClock.clockingOut') : t('shiftClock.clockOut')}
          busy={busy}
          onPress={onPress}
          testID="myNight.clockOut"
        />
        {!past && (
          <Text size={15} style={styles.secondary}>
            {t('shiftClock.stayLine', { end: clockAt(clock.closesAt, locale) })}
          </Text>
        )}
      </>
    );
  else if (clock.phase === 'off')
    body = past ? (
      <>
        <StatusLine words={t('shiftClock.clockedOutAt', { time: at(clock.clockedOutAt) })} done />
        {tapLine}
      </>
    ) : (
      <>
        <StatusLine
          words={t('shiftClock.inOut', { in: at(clock.clockedInAt), out: at(clock.clockedOutAt) })}
          done
        />
        {clock.workedMinutes != null && (
          <Text size={15} weight="medium" style={styles.secondary}>
            {t('shiftClock.recorded', { time: hoursWords(t, clock.workedMinutes) })}
          </Text>
        )}
        {tapLine}
        <Text size={15} style={styles.secondary}>
          {t('shiftClock.helper')}
        </Text>
      </>
    );
  else
    body = (
      <>
        <StatusLine
          words={t('shiftClock.closedAt', { time: clockAt(clock.closesAt, locale) })}
          done={false}
        />
        <Text size={15} weight="medium">
          {t('shiftClock.closedLine')}
        </Text>
      </>
    );

  return (
    <View style={styles.card} testID="myNight.clock">
      {body}
    </View>
  );
}

function StatusLine({ words, done }: { words: string; done: boolean }) {
  return (
    <View style={styles.status}>
      <ShapeMark kind={done ? 'yes' : 'notyet'} side={18} ink={tokens.colorAccent} />
      <Text size={17} weight="semibold" style={styles.shrink}>
        {words}
      </Text>
    </View>
  );
}

function TapLine({ line, words, said }: { line: ClockLine; words: string | null; said: number }) {
  if (words == null) return null;
  const offline = line === 'offIn' || line === 'offOut';

  return (
    <View testID={`myNight.clockLine.${line ?? ''}`}>
      <Notice
        tone={offline ? 'attention' : 'quiet'}
        mark={offline ? '!' : 'i'}
        body={words}
        answer={said}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.spaceMd,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  secondary: { color: tokens.colorInkSecondary },
  shrink: { flexShrink: 1 },
});
