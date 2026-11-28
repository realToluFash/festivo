import type { Provider } from '@soirely/api-client';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  CodeField,
  Field,
  FieldError,
  focusChecked,
  focusRefused,
  keysStayDown,
} from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import type { Candidate } from '../../components/OrganisationOwnership.tsx';
import { ProviderButton } from '../../components/ProviderSignIn.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { ChoiceRow, FocusedScreen, Line, RowList, SectionHead } from '../../components/Summary.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { secondFactorProblem } from './AccountSample.ts';
import { type ProviderStage, TRIP_MS, afterTrip } from './ProviderProofModel.ts';
import { PROVIDER_NAME } from './SecuritySample.ts';

/** Transfer ownership for an owner with no password: Google's or Apple's own button in place of the secondary pill, Transfer in the header as now (sc-22601). */
export function ProviderTransferScreen({
  open,
  provider,
  twoFactor,
  organisation,
  candidates,
  opener,
  onClose,
  onDone,
}: {
  open: boolean;
  provider: Provider;
  twoFactor: boolean;
  organisation: string;
  candidates: readonly Candidate[];
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const { t } = useTranslation();
  const name = PROVIDER_NAME[provider];
  const [picked, setPicked] = useState<string | null>(null);
  const [stage, setStage] = useState<ProviderStage | 'signedIn'>('trip');
  const [ownerSays, setOwnerSays] = useState<{ words: string; answer: object } | null>(null);
  const [codeSays, setCodeSays] = useState<string | null>(null);
  const code = useRef('');
  const codeField = useRef<TextInputInstance>(null);
  const away = useRef<ReturnType<typeof setTimeout>>(undefined);
  const chosen = candidates.find((one) => one.id === picked) ?? null;
  const vouched = stage === 'code' || stage === 'signedIn';

  useEffect(() => () => clearTimeout(away.current), []);

  function ownerChosen(): boolean {
    if (chosen != null) return true;
    setOwnerSays({ words: t('ownership.ownerBlank'), answer: {} });

    return false;
  }

  function trip(): void {
    if (stage !== 'trip' || !ownerChosen()) return;
    setStage('busy');
    away.current = setTimeout(
      () => setStage(afterTrip(twoFactor) === 'code' ? 'code' : 'signedIn'),
      TRIP_MS,
    );
  }

  function transfer(): void {
    if (!vouched || !ownerChosen() || chosen == null) return;
    if (stage === 'code') {
      keysStayDown();
      const problem = secondFactorProblem(code.current);
      if (problem != null) {
        setCodeSays(problem === 'blank' ? t('ownership.codeBlank') : t('waysCard.codeWrong'));
        if (problem === 'blank') focusChecked(codeField);
        else focusRefused(codeField);
        return;
      }
    }
    onDone(chosen.name);
  }

  return (
    <FocusedScreen
      open={open}
      title={t('ownership.transfer')}
      verb={{
        label: t('ownership.transferVerb'),
        on: vouched,
        onPress: transfer,
        testID: 'organisation.transfer.send',
      }}
      onCancel={onClose}
      waits={stage === 'busy'}
      cancelTestID="organisation.transfer.cancel"
      opener={opener}
      testID="organisation.transfer"
    >
      <Line text={t('ownership.transferBody', { organisation })} />
      <View>
        <SectionHead title={t('ownership.newOwner')} />
        {ownerSays != null && <FieldError message={ownerSays.words} answer={ownerSays.answer} />}
        <View accessibilityRole="radiogroup">
          <RowList
            items={candidates.map((member) => ({
              key: member.id,
              row: (
                <ChoiceRow
                  title={member.name}
                  line={member.role}
                  on={member.id === picked}
                  onPress={() => {
                    setPicked(member.id);
                    setOwnerSays(null);
                  }}
                  testID={`organisation.transfer.${member.id}`}
                />
              ),
            }))}
          />
        </View>
      </View>
      {vouched ? (
        <Notice
          tone="quiet"
          mark={tokens.marks.done.glyph}
          markTone="done"
          title={t('waysCard.signedInWith', { provider: name })}
          accentTitle
          detail={stage === 'code' ? SAMPLE.email : null}
          announce
        />
      ) : (
        <View style={styles.prove}>
          <Line text={t('waysCard.proveWithProvider', { provider: name })} />
          <ProviderButton
            provider={provider}
            label={t('waysCard.continueWith', { provider: name })}
            onPress={trip}
            busy={stage === 'busy'}
            testID="organisation.transfer.provider"
          />
        </View>
      )}
      {stage === 'code' && (
        <Field label={t('ownership.code')} error={codeSays}>
          <CodeField
            ref={codeField}
            takesRecoveryCode
            defaultValue=""
            autoFocus
            onChangeText={(text) => {
              code.current = text;
              if (codeSays != null && text.trim() !== '') setCodeSays(null);
            }}
            wrong={codeSays != null}
            submitting={false}
            returnKeyType="done"
            onSubmitEditing={transfer}
            submitBehavior="submit"
            accessibilityLabel={t('ownership.code')}
            testID="organisation.transfer.providerCode"
          />
        </Field>
      )}
      <Line
        text={t('ownership.bothEmailed', { name: chosen?.name ?? t('ownership.theNewOwner') })}
      />
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  prove: { gap: tokens.spaceSm },
});
