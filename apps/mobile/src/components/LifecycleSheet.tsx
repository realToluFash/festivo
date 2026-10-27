import { type OrganisationEvent } from '@soirely/api-client';
import { type RefObject, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
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

  return { asking, pending, ask, go, close };
}

/** The sheet every lifecycle move asks in: `confirm` while it asks, and without it a refusal with Close. Test ids are `testID` with Sheet, Yes, No and Close. */
export function LifecycleSheet({
  phone,
  open,
  opener,
  testID,
  title,
  lines,
  confirm,
  onClose,
}: {
  phone: boolean;
  open: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  testID: string;
  title: string;
  lines: string[];
  confirm: { label: string; keep: string; pending: boolean; onGo: () => void } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onClose={onClose} opener={opener} testID={`${testID}Sheet`}>
      {open && (
        <View style={styles.sheet}>
          <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
            {title}
          </Text>
          {lines.map((line) => (
            <Text key={line} size={tokens.typeBodyPhone.size} muted>
              {line}
            </Text>
          ))}
          <View style={phone ? styles.stacked : styles.actions}>
            {confirm != null ? (
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
  sheet: { gap: tokens.spaceLg, padding: tokens.space3xl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  stacked: { gap: tokens.spaceSm },
});
