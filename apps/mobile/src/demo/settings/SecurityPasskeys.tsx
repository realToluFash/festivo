import { type ReactNode, type Ref, type RefObject, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LEAD_INSET, LineIcon } from '../../components/AccountCard.tsx';
import { PrimaryButton, QuietButton } from '../../components/Buttons.tsx';
import { FieldError } from '../../components/Field.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import {
  FocusedScreen,
  Line,
  OpenRow,
  Row,
  RowList,
  Section,
  TextAction,
  TurningMark,
} from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { codesLine } from '../../kit/securityPage.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  APP_CHOICE,
  CARD_LINE,
  type FactorRow,
  type KeyMode,
  factorRows,
  type Factors,
  offersAddApp,
  offersAddPasskey,
  PASSKEY_REFUSED,
  passkeyChoice,
  type Unlock,
  WAITING,
} from './PasskeysModel.ts';

/** The Two-factor card with passkeys: each factor newest first, Recovery codes, then what can be added. */
export function PasskeyFactorsSection({
  factors,
  codesLeft,
  email,
  locale,
  opened,
  removeRef,
  turnOffRef,
  newCodesRef,
  addRef,
  onBlock,
  onToggle,
  onRemove,
  onTurnOff,
  onNewCodes,
  onAddPasskey,
  onAddApp,
}: {
  factors: Factors;
  codesLeft: number;
  email: string;
  locale: string;
  opened: string | null;
  removeRef: Ref<ViewInstance>;
  turnOffRef: Ref<ViewInstance>;
  newCodesRef: Ref<ViewInstance>;
  addRef: Ref<ViewInstance>;
  onBlock: (id: string, block: ViewInstance | null) => void;
  onToggle: (id: string) => void;
  onRemove: (row: FactorRow) => void;
  onTurnOff: () => void;
  onNewCodes: () => void;
  onAddPasskey: () => void;
  onAddApp: () => void;
}) {
  const { t } = useTranslation();
  const rows = factorRows(factors, locale);
  const turnOff = (
    <TextAction
      ref={turnOffRef}
      label={t('twoFactorCard.turnOffAsks')}
      removes
      onPress={onTurnOff}
      consequence={`Every factor goes, passkeys included. We will email ${email} to say it was turned off.`}
      accessibilityLabel={t('twoFactorCard.turnOff')}
      testID="passkeys.turnOff"
    />
  );

  const opening = (id: string, title: string, line: string, icon: ReactNode, offer: ReactNode) => ({
    key: id,
    inset: LEAD_INSET,
    selected: opened === id,
    row: (
      <View ref={(block) => onBlock(id, block)} collapsable={false}>
        <OpenRow
          title={title}
          line={line}
          lead={icon}
          weight="semibold"
          lit
          open={opened === id}
          onToggle={() => onToggle(id)}
          accessibilityLabel={`${title}. ${line}`}
          testID={`passkeys.${id}`}
        >
          {offer}
        </OpenRow>
      </View>
    ),
  });

  const adding = (id: string, label: string, onPress: () => void, ref?: Ref<ViewInstance>) => ({
    key: id,
    inset: LEAD_INSET,
    row: (
      <Row
        ref={ref}
        title={label}
        lead={<LineIcon name="plus" />}
        accent
        onPress={onPress}
        testID={`passkeys.${id}`}
      />
    ),
  });

  return (
    <Section title={t('twoFactorCard.title')} foot={CARD_LINE}>
      <RowList
        items={[
          ...rows.map((row) =>
            opening(
              row.id,
              row.title,
              row.line,
              <LineIcon name={row.kind === 'app' ? 'shield' : 'key'} />,
              row.removable ? (
                <TextAction
                  ref={opened === row.id ? removeRef : undefined}
                  label="Remove…"
                  removes
                  onPress={() => onRemove(row)}
                  accessibilityLabel={`Remove ${row.title}, ${row.line}`}
                  testID={`passkeys.${row.id}.remove`}
                />
              ) : (
                turnOff
              ),
            ),
          ),
          opening(
            'codes',
            t('twoFactorCard.recoveryCodes'),
            codesLine(codesLeft, t),
            <LineIcon name="lock" />,
            <TextAction
              ref={newCodesRef}
              label={t('twoFactorCard.makeNewCodes')}
              onPress={onNewCodes}
              consequence={t('twoFactorCard.newWarningBody')}
              testID="passkeys.newCodes"
            />,
          ),
          ...(offersAddPasskey(factors)
            ? [adding('addPasskey', 'Add a passkey', onAddPasskey, addRef)]
            : []),
          ...(offersAddApp(factors)
            ? [adding('addApp', 'Add an authenticator app', onAddApp)]
            : []),
          ...(rows.length > 1
            ? [{ key: 'turnOff', inset: 0, row: <View style={styles.turnOff}>{turnOff}</View> }]
            : []),
        ]}
      />
    </Section>
  );
}

/** What the system's sheet can answer, played by the demo since it writes nothing to the device. */
function SheetStandIn({
  mode,
  onSaved,
  onUsed,
  onRefused,
  onExists,
  onCancelled,
}: {
  mode: KeyMode;
  onSaved: () => void;
  onUsed: () => void;
  onRefused: () => void;
  onExists: () => void;
  onCancelled: () => void;
}) {
  return (
    <DemoOnly title="Demo: in the build, the system’s own passkey sheet opens here (iOS’s on iPhone and iPad, Credential Manager on Android). Answer it as the sheet would.">
      {mode === 'proof' ? (
        <>
          <QuietButton label="Use the passkey" onPress={onUsed} testID="passkeys.sheet.use" />
          <QuietButton
            label="A passkey the server refuses"
            onPress={onRefused}
            testID="passkeys.sheet.refused"
          />
        </>
      ) : (
        <QuietButton label="Save the passkey" onPress={onSaved} testID="passkeys.sheet.save" />
      )}
      {mode === 'add' && (
        <QuietButton
          label="Already saved in this manager"
          onPress={onExists}
          testID="passkeys.sheet.exists"
        />
      )}
      <QuietButton label="Cancel the sheet" onPress={onCancelled} testID="passkeys.sheet.cancel" />
    </DemoOnly>
  );
}

export function Waiting() {
  useReadOut(WAITING);

  return (
    <View style={styles.waiting} accessible>
      <TurningMark side={16} />
      <Text size={15} weight="medium" style={styles.secondary}>
        {WAITING}
      </Text>
    </View>
  );
}

/** Turn on two-factor's choice, a step that takes a passkey with the sheet over it, and Add a passkey. */
export function PasskeyScreen({
  open,
  mode,
  unlock,
  lead,
  startSheet,
  startRefused = false,
  opener,
  onCancel,
  onApp,
  onMade,
  onAccepted,
  onCodeInstead,
}: {
  open: boolean;
  mode: KeyMode;
  unlock: Unlock;
  /** What the step is for, under the title, on a step that takes a passkey. */
  lead: string;
  startSheet: boolean;
  startRefused?: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  onCancel: () => void;
  onApp: () => void;
  onMade: () => void;
  onAccepted: () => void;
  onCodeInstead: () => void;
}) {
  const { t } = useTranslation();
  const [sheet, setSheet] = useState(startSheet);
  const [refused, setRefused] = useState(startRefused);
  const choice = passkeyChoice(unlock);

  function openSheet(): void {
    setRefused(false);
    setSheet(true);
  }

  const stand = sheet && (
    <SheetStandIn
      mode={mode}
      onSaved={() => {
        setSheet(false);
        onMade();
      }}
      onUsed={() => {
        setSheet(false);
        onAccepted();
      }}
      onRefused={() => {
        setSheet(false);
        setRefused(true);
      }}
      onExists={() => {
        setSheet(false);
        onCancel();
      }}
      onCancelled={() => {
        setSheet(false);
        if (mode === 'add') onCancel();
      }}
    />
  );

  if (mode === 'choose')
    return (
      <FocusedScreen
        open={open}
        title={t('twoFactorCard.turnOn')}
        verb={null}
        onCancel={onCancel}
        cancelTestID="passkeys.choose.cancel"
        opener={opener}
        testID="passkeys.choose.screen"
      >
        <Line text="Choose how you confirm it’s you after your password, Google or Apple." />
        <RowList
          items={[
            {
              key: 'passkey',
              inset: LEAD_INSET,
              row: (
                <Row
                  title={choice.title}
                  line={choice.line}
                  lead={<LineIcon name="key" />}
                  opens={!sheet}
                  trail={sheet ? <TurningMark side={16} /> : undefined}
                  off={sheet}
                  onPress={openSheet}
                  testID="passkeys.choose.passkey"
                />
              ),
            },
            {
              key: 'app',
              inset: LEAD_INSET,
              row: (
                <Row
                  title={APP_CHOICE.title}
                  line={APP_CHOICE.line}
                  lead={<LineIcon name="shield" />}
                  opens
                  off={sheet}
                  onPress={onApp}
                  testID="passkeys.choose.app"
                />
              ),
            },
          ]}
        />
        {sheet && <Waiting />}
        {stand}
      </FocusedScreen>
    );

  if (mode === 'add')
    return (
      <FocusedScreen
        open={open}
        title="Add a passkey"
        verb={null}
        onCancel={onCancel}
        cancelTestID="passkeys.add.cancel"
        opener={opener}
        testID="passkeys.add.screen"
      >
        <Line text="Follow the steps on your screen to save a passkey. Save it only on your own phone or computer." />
        {sheet ? <Waiting /> : null}
        {stand}
      </FocusedScreen>
    );

  return (
    <FocusedScreen
      open={open}
      title={t('waysCard.proveTitle')}
      verb={null}
      onCancel={onCancel}
      cancelTestID="passkeys.proof.cancel"
      opener={opener}
      testID="passkeys.proof.screen"
    >
      <Line text={lead} />
      {sheet && <Waiting />}
      {refused && <FieldError message={PASSKEY_REFUSED} />}
      <View style={styles.ways}>
        <PrimaryButton
          label="Use a passkey"
          off={sheet}
          onPress={openSheet}
          testID="passkeys.proof.again"
        />
        <QuietButton
          label="Use a code instead"
          onPress={onCodeInstead}
          testID="passkeys.proof.code"
        />
      </View>
      {stand}
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: 44,
  },
  ways: { gap: tokens.spaceXs, alignItems: 'stretch' },
  turnOff: { paddingVertical: tokens.spaceXs },
});
