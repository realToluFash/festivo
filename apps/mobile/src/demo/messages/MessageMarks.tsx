import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { StatusMark } from '../settings/Summary.tsx';
import { type MarkKey, type Where, piecesOf } from './MessagesSample.ts';
import { say } from './MessagesWords.ts';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

type Shape = { d: string } | { cx: number; cy: number; r: number };

const PATHS = {
  send: [{ d: 'M12 19V5' }, { d: 'M5.5 11.5 12 5l6.5 6.5' }],
  braces: [
    { d: 'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1' },
    { d: 'M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1' },
  ],
  undo: [{ d: 'M9 14 4 9l5-5' }, { d: 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11' }],
  page: [
    { d: 'M6 2.5h8.5L19 7v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1-1.5z' },
    { d: 'M14 2.5V7h5' },
    { d: 'M8.5 12h7' },
    { d: 'M8.5 15.5h7' },
  ],
  sms: [
    {
      d: 'M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17.5H4A1.5 1.5 0 0 1 2.5 16V6A1.5 1.5 0 0 1 4 4.5z',
    },
    { d: 'M8 11h.01' },
    { d: 'M12 11h.01' },
    { d: 'M16 11h.01' },
  ],
  wa: [
    { d: 'M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.2a8.5 8.5 0 1 1 15.6-4.7z' },
    { d: 'M9 9.5c0 3 2.5 5.5 5.5 5.5' },
  ],
  group: [
    { cx: 9, cy: 8, r: 3.5 },
    { d: 'M2.5 20a6.5 6.5 0 0 1 13 0' },
    { cx: 17.5, cy: 9, r: 2.5 },
    { d: 'M16.5 14.6A5 5 0 0 1 21.5 19' },
  ],
  question: [{ d: 'M9.2 9.2a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2 1-1.2 1.8v.6' }, { d: 'M12 17.6h.01' }],
  slash: [{ cx: 12, cy: 12, r: 9 }, { d: 'M5.6 5.6l12.8 12.8' }],
  cross: [{ cx: 12, cy: 12, r: 9.5 }, { d: 'm8.5 8.5 7 7' }, { d: 'm15.5 8.5-7 7' }],
  ring: [{ cx: 12, cy: 12, r: 9.5 }, { d: 'm7.5 12.2 3 3 6-6.4' }],
} satisfies Record<string, readonly Shape[]>;

export type MarkName = keyof typeof PATHS;

/** Messaging's own marks, drawn as the boards draw them; always beside the words that say the same. */
export function MessageGlyph({
  name,
  size = 18,
  ink,
  weight = 2,
}: {
  name: MarkName;
  size?: number;
  ink: string;
  weight?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...hidden}
    >
      {PATHS[name].map((shape: Shape, index) =>
        'd' in shape ? (
          <Path key={index} d={shape.d} />
        ) : (
          <Circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />
        ),
      )}
    </Svg>
  );
}

/** Where a message went or came from, as its mark: their page, or the channel's. */
export function WhereMark({ where, ink, size = 14 }: { where: Where; ink: string; size?: number }) {
  if (where === 'email') return <Glyph name="mail" size={size} ink={ink} />;

  return <MessageGlyph name={where} size={size} ink={ink} />;
}

/** A delivery's shape (sc-3942's table), never colour alone. */
export function DeliveryMark({ mark, side = 14 }: { mark: MarkKey; side?: number }) {
  const ink2 = tokens.colorInkSecondary;

  switch (mark) {
    case 'delivered':
      return <StatusMark kind="yes" side={side} ink={tokens.colorInk} />;
    case 'sending':
      return <StatusMark kind="waiting" side={side} ink={tokens.colorAttention} />;
    case 'none':
      return <StatusMark kind="ended" side={side} ink={ink2} />;
    case 'sent':
      return <MessageGlyph name="ring" size={side} ink={tokens.marks.done.fill} weight={2.6} />;
    case 'bounced':
      return <MessageGlyph name="cross" size={side} ink={tokens.colorBroken} weight={2.6} />;
    case 'optout':
      return <MessageGlyph name="slash" size={side} ink={ink2} weight={2.2} />;
    case 'unconfirmed':
      return (
        <View
          style={[styles.ring, { width: side, height: side, borderRadius: side / 2 }]}
          {...hidden}
        >
          <MessageGlyph name="question" size={Math.round(side * 0.9)} ink={ink2} weight={2.6} />
        </View>
      );
    case 'notsent':
      return (
        <View style={[styles.notSent, { width: side, height: side }]} {...hidden}>
          <View style={[styles.dash, { width: Math.round(side * 0.5) }]} />
        </View>
      );
  }
}

/** A message's words with each token drawn as a Tint chip, named for what it becomes; the words wrap one by one around it. */
export function TokenWords({
  text,
  size,
  ink,
  lineHeight,
  end = false,
}: {
  text: string;
  size: number;
  ink: string;
  lineHeight: number;
  end?: boolean;
}) {
  const pieces = piecesOf(text);
  if (!pieces.some((piece) => piece.token))
    return (
      <Text size={size} weight="medium" style={{ color: ink, lineHeight }}>
        {text}
      </Text>
    );
  const label = pieces.map((piece) => (piece.token ? say.tokenName(piece.text) : piece.text));

  return (
    <View
      style={[styles.flow, end && styles.flowEnd]}
      accessible
      accessibilityLabel={label.join('')}
    >
      {pieces.flatMap((piece, index) =>
        piece.token ? (
          <View key={index} style={[styles.token, { minHeight: lineHeight }]}>
            <Text size={14} weight="semibold" accessible={false} style={styles.tokenWord}>
              {piece.text}
            </Text>
          </View>
        ) : (
          (piece.text.match(/\S+\s*|\s+/gu) ?? []).map((word, at) => (
            <Text
              key={`${index}.${at}`}
              size={size}
              weight="medium"
              accessible={false}
              style={{ color: ink, lineHeight }}
            >
              {word}
            </Text>
          ))
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2,
    borderColor: tokens.colorInkSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notSent: {
    borderRadius: 5,
    backgroundColor: tokens.colorBrokenTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dash: { height: 2.5, borderRadius: 2, backgroundColor: tokens.colorBroken },
  flow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  flowEnd: { justifyContent: 'flex-end' },
  token: {
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceSm,
    marginHorizontal: 1,
    borderRadius: 7,
    backgroundColor: tokens.colorAccentTint,
  },
  tokenWord: { color: tokens.colorAccentText },
});
