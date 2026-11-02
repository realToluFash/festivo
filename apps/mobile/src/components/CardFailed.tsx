import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';

/** What a tap on Try again set: a failure it answers takes focus to the line, and a first one is read out. */
export type Unread = { tapped: boolean };

/** A card whose load failed keeps its heading, says so in one line, and offers Try again (sc-24696). */
export function CardFailed({
  kind,
  title,
  words,
  unread,
  onRetry,
  testID,
}: {
  kind: LayoutKind;
  title: string;
  words: string;
  unread: Unread;
  onRetry: () => void;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={cardFrame(kind)}>
      <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
        {title}
      </Text>
      <Notice
        tone="broken"
        mark={tokens.marks.broken.glyph}
        body={words}
        answer={unread}
        takesFocus={unread.tapped}
      />
      <SecondaryButton label={t('devices.retry')} onPress={onRetry} testID={testID} />
    </View>
  );
}
