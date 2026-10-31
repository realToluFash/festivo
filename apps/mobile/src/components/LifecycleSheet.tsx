import { type OrganisationEvent } from '@soirely/api-client';
import { type ReactNode, type RefObject, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { tokens } from '../theme/tokens.ts';
import { AnswerHeading } from './AnswerHeading.tsx';
import { DestructiveButton, PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { Sheet } from './Sheet.tsx';
import { Text } from './Text.tsx';
import { type ScreenReaderTarget } from './screenReaderFocus.ts';

type Confirming<C> = { kind: 'confirm'; pending: boolean; failed: boolean } & C;

export type Asking<C, R extends { kind: string }> = Confirming<C> | Exclude<R, { kind: 'failed' }>;

/** Every lifecycle move (Make live, Pause, Call off and End now) asks, calls, and on a refusal its sheet turns into the reason; `refusalOf` is the move's mapping in the kit, and `reloads` says which refusals read the event again. */
export function useLifecycleAction<C extends object, R extends { kind: string }>({
  event,
  onChange,
  onDone,
  refusalOf,
  reloads = () => true,
}: {
  event: OrganisationEvent;
  onChange: (event: OrganisationEvent) => void;
  onDone?: () => void;
  refusalOf: (error: unknown) => R;
  reloads?: (refusal: Exclude<R, { kind: 'failed' }>) => boolean;
}) {
  const [asking, setAsking] = useState<Asking<C, R> | null>(null);
  const pending = asking?.kind === 'confirm' && (asking as Confirming<C>).pending;

  const confirming = (choice: C, busy: boolean, failed: boolean): Confirming<C> => ({
    ...choice,
    kind: 'confirm',
    pending: busy,
    failed,
  });

  const ask = (choice: C) => setAsking(confirming(choice, false, false));
  /** Opens refused, without asking first, when the event already says why. */
  const tell = (refusal: Exclude<R, { kind: 'failed' }>) => setAsking(refusal);
  const close = () => !pending && setAsking(null);

  const go = (choice: C, call: () => Promise<{ event: OrganisationEvent }>) => {
    setAsking(confirming(choice, true, false));
    call().then(
      ({ event: moved }) => {
        setAsking(null);
        onChange(moved);
        onDone?.();
      },
      (error: unknown) => {
        const refusal = refusalOf(error);

        if (refusal.kind === 'failed') {
          setAsking(confirming(choice, false, true));
          return;
        }

        const shown = refusal as Exclude<R, { kind: 'failed' }>;

        if (!reloads(shown)) {
          setAsking(shown);
          return;
        }

        api.event(event.id).then(
          (latest) => {
            onChange(latest);
            setAsking(shown);
          },
          () => setAsking(confirming(choice, false, true)),
        );
      },
    );
  };

  return { asking, pending, ask, tell, go, close };
}

/** The sheet every lifecycle move asks in: `confirm` while it asks, and without it a refusal with Close, and `onward` where the refusal has a way forward, and `retold` takes focus to the title when a refusal replaces the question. `children` go under the lines, which scroll between the title and the buttons. Test ids are `testID` with Sheet, Yes, No, Close and Onward. */
export function LifecycleSheet({
  phone,
  open,
  opener,
  testID,
  title,
  lines,
  confirm,
  onward = null,
  retold,
  onClose,
  children,
}: {
  phone: boolean;
  open: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  testID: string;
  title: string;
  lines: string[];
  confirm: {
    label: string;
    keep: string;
    pending: boolean;
    /** Something ends: the destructive button confirms, and keeping it is a text action. */
    ends?: boolean;
    onGo: () => void;
  } | null;
  onward?: { label: string; onPress: () => void } | null;
  retold?: unknown;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onClose={onClose} opener={opener} testID={`${testID}Sheet`}>
      {open && (
        <View style={styles.sheet}>
          <AnswerHeading answer={retold} size={tokens.typeTitleSection.size} weight="bold">
            {title}
          </AnswerHeading>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.lines}
            keyboardShouldPersistTaps="handled"
          >
            {lines.map((line) => (
              <Text key={line} size={tokens.typeBodyPhone.size} muted>
                {line}
              </Text>
            ))}
            {children}
          </ScrollView>
          <View style={phone ? styles.stacked : styles.actions}>
            {confirm?.ends === true ? (
              <>
                <DestructiveButton
                  label={confirm.label}
                  onPress={confirm.onGo}
                  busy={confirm.pending}
                  testID={`${testID}Yes`}
                />
                <QuietButton
                  label={confirm.keep}
                  onPress={onClose}
                  off={confirm.pending}
                  testID={`${testID}No`}
                />
              </>
            ) : confirm != null ? (
              <>
                <PrimaryButton
                  label={confirm.label}
                  onPress={confirm.onGo}
                  busy={confirm.pending}
                  testID={`${testID}Yes`}
                />
                <SecondaryButton
                  label={confirm.keep}
                  onPress={onClose}
                  off={confirm.pending}
                  stacked={phone}
                  testID={`${testID}No`}
                />
              </>
            ) : onward != null && phone ? (
              <>
                <PrimaryButton
                  label={onward.label}
                  onPress={onward.onPress}
                  testID={`${testID}Onward`}
                />
                <SecondaryButton
                  label={t('eventLive.close')}
                  onPress={onClose}
                  stacked
                  testID={`${testID}Close`}
                />
              </>
            ) : onward != null ? (
              <View style={styles.footer}>
                <SecondaryButton
                  label={t('eventLive.close')}
                  onPress={onClose}
                  testID={`${testID}Close`}
                />
                <PrimaryButton
                  label={onward.label}
                  onPress={onward.onPress}
                  testID={`${testID}Onward`}
                />
              </View>
            ) : (
              <PrimaryButton
                label={t('eventLive.close')}
                onPress={onClose}
                testID={`${testID}Close`}
              />
            )}
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { flexShrink: 1, gap: tokens.spaceLg, padding: tokens.space3xl },
  body: { flexShrink: 1, flexGrow: 0 },
  lines: { gap: tokens.spaceLg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  stacked: { gap: tokens.spaceSm },
  footer: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
});
