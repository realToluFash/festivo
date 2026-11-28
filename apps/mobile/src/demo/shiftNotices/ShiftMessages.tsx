import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SecondaryButton } from '../../components/Buttons.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { MessageGlyph } from '../messages/MessageMarks.tsx';
import {
  CATEGORY,
  CHANNELS,
  CHANNEL_NAMES,
  type Channel,
  KIND_NAMES,
  MESSAGE_KINDS,
  type Message,
  type MessageKind,
  TIME_SENSITIVE,
  canBeTimeSensitive,
  channelOf,
  messageKindOf,
  messageOf,
  urgentOf,
} from './shiftMessagesModel.ts';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

const CLOCK = '19:55';
const TODAY = 'Thursday, October 15';

/** The shift page the message opens: sc-3915's Your night, on its sample. */
function openShift(): void {
  router.push('/demo/my-night' as Href);
}

export function ShiftMessagesRoute() {
  const params = useLocalSearchParams<{ kind?: string; channel?: string; urgent?: string }>();
  const kind = messageKindOf(params.kind);
  const channel = channelOf(params.channel);
  const urgent = urgentOf(kind, params.urgent);

  return (
    <ShiftMessages
      key={`${kind}|${channel}|${urgent ? 1 : 0}`}
      kind={kind}
      channel={channel}
      urgent={urgent}
    />
  );
}

/** ShiftMessages-Phone (sc-4333): one message as the person on the staff receives it, drawn once, on a phone; a tablet shows the phone's column. */
function ShiftMessages({
  kind,
  channel,
  urgent,
}: {
  kind: MessageKind;
  channel: Channel;
  urgent: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { kind: layout, height } = useLayout();
  const message = messageOf(kind, channel);
  const push = channel === 'push';

  return (
    <ScrollView
      style={push ? styles.dark : styles.page}
      contentContainerStyle={{ paddingBottom: insets.bottom }}
    >
      <View
        style={[
          styles.screen,
          push ? styles.dark : styles.page,
          { minHeight: height * 0.7, paddingTop: insets.top },
        ]}
      >
        <Pressable onPress={goBack} accessibilityRole="button" style={styles.back}>
          <Text size={15} weight="semibold" style={push ? styles.onDark : styles.accent}>
            Back
          </Text>
        </Pressable>
        <View style={[styles.column, layout !== 'phone' && styles.columnWide]}>
          {push ? (
            <>
              <View style={styles.lockTop} {...hidden}>
                <Text accessible={false} size={17} weight="semibold" style={styles.onDarkSecondary}>
                  {TODAY}
                </Text>
                <Text
                  accessible={false}
                  size={80}
                  weight="semibold"
                  style={[styles.onDark, styles.num]}
                >
                  {CLOCK}
                </Text>
              </View>
              <PushCard message={message} urgent={urgent} kind={kind} />
            </>
          ) : channel === 'sms' ? (
            <SmsThread message={message} kind={kind} />
          ) : (
            <WhatsAppThread message={message} kind={kind} />
          )}
        </View>
      </View>
      <View style={styles.demoPad}>
        <DemoOnly
          title={`${KIND_NAMES[kind]} by ${CHANNEL_NAMES[channel]}. Push goes in the ${CATEGORY} category. ${canBeTimeSensitive(kind) ? `Inside 24 hours of the start it is time-sensitive: iOS's ${TIME_SENSITIVE}, Android's high-importance ${CATEGORY} channel.` : 'It is never time-sensitive, inside 24 hours of the start or not.'} A tap opens the shift page. The phone around the message is the system's, drawn as a stand-in.`}
        >
          {CHANNELS.filter((one) => one !== channel).map((one) => (
            <SecondaryButton
              key={one}
              label={`By ${CHANNEL_NAMES[one]}`}
              onPress={() => router.setParams({ channel: one })}
              testID={`shiftMessages.channel.${one}`}
            />
          ))}
          {push && canBeTimeSensitive(kind) && (
            <SecondaryButton
              label={urgent ? 'Inside 24 hours · on' : 'Inside 24 hours'}
              onPress={() => router.setParams({ urgent: urgent ? '0' : '1' })}
              testID="shiftMessages.urgent"
            />
          )}
          {MESSAGE_KINDS.filter((one) => one !== kind).map((one) => (
            <SecondaryButton
              key={one}
              label={KIND_NAMES[one]}
              onPress={() => router.setParams({ kind: one })}
              testID={`shiftMessages.kind.${one}`}
            />
          ))}
        </DemoOnly>
      </View>
    </ScrollView>
  );
}

/** The push as the system draws it, in white with the house ink; a long press opens its lines, as iOS does. */
function PushCard({
  message,
  urgent,
  kind,
}: {
  message: Message;
  urgent: boolean;
  kind: MessageKind;
}) {
  const [open, setOpen] = useState(true);
  const spoken = [urgent ? TIME_SENSITIVE : null, message.title, ...message.lines]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      onPress={openShift}
      onLongPress={() => setOpen((was) => !was)}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Opens the shift page"
      style={({ pressed }) => [styles.push, pressed && styles.pressed]}
      testID={`shiftMessages.push.${kind}`}
    >
      <View style={styles.pushMark} {...hidden}>
        <Text size={18} weight="bold" accessible={false} style={styles.onDark}>
          S
        </Text>
      </View>
      <View style={styles.words} {...hidden}>
        {urgent && (
          <View style={styles.sensitive} testID="shiftMessages.timeSensitive">
            <Glyph name="clock" size={12} ink={tokens.colorAttentionText} />
            <Text accessible={false} size={12} weight="semibold" style={styles.attention}>
              {TIME_SENSITIVE.toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.pushHead}>
          <Text accessible={false} size={15} weight="semibold" style={styles.grow}>
            {message.title}
          </Text>
          <Text accessible={false} size={13} style={styles.secondary}>
            now
          </Text>
        </View>
        {message.lines.map((line) => (
          <Text
            key={line}
            accessible={false}
            size={15}
            numberOfLines={open ? undefined : 1}
            style={styles.num}
          >
            {line}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

function ThreadHead({ channel }: { channel: 'sms' | 'wa' }) {
  return (
    <View style={styles.threadHead}>
      <MessageGlyph name={channel} size={16} ink={tokens.colorInkSecondary} />
      <Text size={13} weight="semibold" style={styles.secondary}>
        {channel === 'sms' ? `Text message · Today ${CLOCK}` : `WhatsApp · Today ${CLOCK}`}
      </Text>
    </View>
  );
}

/** The SMS: the organisation's name first and the shift page's link last, which opens the page. */
function SmsThread({ message, kind }: { message: Message; kind: MessageKind }) {
  const words = message.link == null ? message.text : message.text.replace(message.link, '').trim();

  return (
    <View style={styles.thread} testID={`shiftMessages.sms.${kind}`}>
      <ThreadHead channel="sms" />
      <View style={styles.bubble}>
        <Text size={15} style={styles.body}>
          {words}
        </Text>
        {message.link != null && (
          <Pressable
            onPress={openShift}
            accessibilityRole="link"
            accessibilityLabel={message.link}
            style={styles.link}
            testID="shiftMessages.sms.link"
          >
            <Text size={15} weight="medium" style={[styles.accent, styles.underline]}>
              {message.link}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** WhatsApp's template: the SMS's words with My shift in place of the link, and no button on the last message. */
function WhatsAppThread({ message, kind }: { message: Message; kind: MessageKind }) {
  return (
    <View style={styles.thread} testID={`shiftMessages.whatsApp.${kind}`}>
      <ThreadHead channel="wa" />
      <View style={styles.waCard}>
        <Text size={15} style={[styles.body, styles.waBody]}>
          {message.text}
        </Text>
        {message.button != null && (
          <Pressable
            onPress={openShift}
            accessibilityRole="button"
            style={({ pressed }) => [styles.waButton, pressed && styles.pressed]}
            testID="shiftMessages.whatsApp.button"
          >
            <Glyph name="link" size={16} ink={tokens.colorAccentText} />
            <Text size={15} weight="semibold" style={styles.accent}>
              {message.button}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  dark: { flex: 1, backgroundColor: tokens.colorDark },
  screen: { paddingHorizontal: tokens.spaceMd },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  column: { gap: tokens.spaceXl, width: '100%', paddingBottom: tokens.spaceXl },
  columnWide: { maxWidth: 420, alignSelf: 'center' },
  lockTop: { alignItems: 'center', gap: tokens.spaceXs, paddingVertical: tokens.spaceXl },
  push: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  pressed: { opacity: tokens.opacityPressed },
  pushMark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: tokens.colorAccentHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1, minWidth: 0, gap: 2 },
  pushHead: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.spaceSm },
  sensitive: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  thread: { gap: tokens.spaceSm, alignItems: 'flex-start', paddingTop: tokens.spaceLg },
  threadHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  bubble: {
    maxWidth: 320,
    gap: tokens.spaceXs,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: tokens.spaceXs,
    backgroundColor: tokens.colorInsetBorder,
  },
  body: { lineHeight: 15 * 1.45 },
  link: { minHeight: tokens.sizeHit, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  waCard: {
    maxWidth: 320,
    overflow: 'hidden',
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  waBody: { paddingVertical: tokens.spaceMd, paddingHorizontal: 14 },
  waButton: {
    flexDirection: 'row',
    gap: tokens.spaceXs,
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  accent: { color: tokens.colorAccentText },
  onDark: { color: tokens.colorInkOnDark },
  onDarkSecondary: { color: tokens.colorInkOnDarkSecondary },
  num: { fontVariant: ['tabular-nums'] },
  demoPad: { paddingHorizontal: tokens.spaceLg, backgroundColor: tokens.colorPage },
});
