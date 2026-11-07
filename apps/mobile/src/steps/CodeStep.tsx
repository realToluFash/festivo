import { formatCountdown } from '@soirely/domain';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { QuietButton } from '../components/Buttons.tsx';
import { type CodeStatus, asksForCode } from '../kit/code.ts';
import { tokens } from '../theme/tokens.ts';
import { CodeBoxes, type CodeBoxesHandle } from './CodeBoxes.tsx';
import { Heading, Says } from './Lines.tsx';

export type CodeStepStatus = CodeStatus | { kind: 'verified' };

/** A code's step: six boxes the sixth digit sends, one line when it is wrong, and the countdown to a new one. An expired or spent code takes the intro's place. */
export function CodeStep({
  copy,
  title,
  intro,
  wrong,
  status,
  cooldown,
  onCode,
  onResend,
  children,
  testID,
}: {
  /** The catalogue the screen's words come from, `verifyEmail` or `verifyPhone`. */
  copy: 'verifyEmail' | 'verifyPhone';
  title: string;
  intro: string;
  wrong: string;
  status: CodeStepStatus;
  cooldown: number;
  onCode: (code: string) => void;
  onResend: () => void;
  /** Other quiet ways on, such as Text it to me instead. */
  children?: ReactNode;
  testID: string;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const boxes = useRef<CodeBoxesHandle>(null);
  const done = status.kind === 'verified';
  const spent = status.kind === 'expired' || status.kind === 'exhausted';

  useEffect(() => {
    if (status.kind === 'wrong') boxes.current?.refuse();
  }, [status]);

  return (
    <>
      <Heading
        title={spent ? t(`${copy}.${status.kind}Title`) : title}
        intro={spent ? t(`${copy}.${status.kind}Body`) : intro}
      />
      {(done || asksForCode(status)) && (
        <View style={styles.boxes}>
          <CodeBoxes
            ref={boxes}
            label={t('steps.codeLabel')}
            value={code}
            onChange={setCode}
            onFull={(full) => {
              if (status.kind !== 'verifying') onCode(full);
            }}
            done={done}
            testID={`${testID}.code`}
          />
          {status.kind === 'wrong' && code === '' && <Says words={wrong} />}
          {status.kind === 'failed' && <Says words={t(`${copy}.failedBody`)} />}
        </View>
      )}
      {!done && (
        <View style={[styles.ways, spent && styles.waysSpent]}>
          {children}
          <QuietButton
            label={
              cooldown > 0
                ? t(`${copy}.resendIn`, { time: formatCountdown(cooldown) })
                : t(`${copy}.resend`)
            }
            off={cooldown > 0}
            onPress={onResend}
            testID={`${testID}.resend`}
          />
        </View>
      )}
    </>
  );
}

/** Time for the green boxes and the success tap before the next step slides in. */
export const NEXT_STEP_MS = 500;

const styles = StyleSheet.create({
  boxes: { marginTop: tokens.space4xl },
  ways: { marginTop: tokens.spaceLg, alignItems: 'flex-start' },
  waysSpent: { marginTop: tokens.space3xl },
});
