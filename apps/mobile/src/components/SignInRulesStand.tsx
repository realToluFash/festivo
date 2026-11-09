import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Row, RowList, ShapeMark } from './Summary.tsx';

const MARK = 22;

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

export type StandMark = 'met' | 'needs' | 'notApplicable';

/** One rule, worded for the reader, with its mark and what a screen reader hears. */
export interface StandRule {
  key: string;
  mark: StandMark;
  title: string;
  line: string;
  label: string;
}

/** Where you stand: each rule with its mark, under the card. */
export function StandRules({ rules }: { rules: readonly StandRule[] }) {
  return (
    <RowList
      items={rules.map((rule) => ({
        key: rule.key,
        inset: MARK + tokens.spaceLg,
        row: (
          <Row
            lead={<RuleMark mark={rule.mark} />}
            title={rule.title}
            line={rule.line}
            accessibilityLabel={rule.label}
            testID={`signInRules.rule.${rule.key}`}
          />
        ),
      }))}
    />
  );
}

/** Met is the green tick, needs you the amber half disc, and doesn't apply a Sunk disc with a bar. */
function RuleMark({ mark }: { mark: StandMark }) {
  if (mark === 'met') return <ShapeMark kind="yes" side={MARK} ink={tokens.marks.done.ink} />;
  if (mark === 'needs')
    return <ShapeMark kind="waiting" side={MARK} ink={tokens.colorAttentionText} />;

  return (
    <View style={styles.notApplicable} {...hidden}>
      <View style={styles.bar} />
    </View>
  );
}

export interface StandChange {
  at: string;
  title: string;
  line: string;
  isNew: boolean;
  label: string;
}

/** What changed, newest first, a change this device has not shown tagged New. */
export function StandChanges({
  changes,
  none,
  newWord,
}: {
  changes: readonly StandChange[];
  none: { title: string; line: string };
  newWord: string;
}) {
  if (changes.length === 0) return <Row title={none.title} line={none.line} />;

  return (
    <RowList
      items={changes.map((change) => ({
        key: change.at,
        row: (
          <Row
            title={change.title}
            tag={change.isNew ? { kind: 'now', word: newWord } : null}
            line={change.line}
            accessibilityLabel={change.label}
            testID={`signInRules.change.${change.at}`}
          />
        ),
      }))}
    />
  );
}

const styles = StyleSheet.create({
  notApplicable: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralFill,
  },
  bar: {
    width: Math.round(MARK * 0.45),
    height: 2,
    borderRadius: 1,
    backgroundColor: tokens.colorInkSecondary,
  },
});
