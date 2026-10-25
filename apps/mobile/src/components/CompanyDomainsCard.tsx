import { ApiError, type CompanyDomains, type Membership } from '@soirely/api-client';
import { companyDomainProblem, domainOf, normaliseDomain } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { Field, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';
import { ReadOut } from './ReadOut.tsx';
import { useScrolledToTop } from './Screen.tsx';

type Flash = { kind: 'added' | 'removed'; domain: string } | null;

/** Settings > Organisation's "Company domain joining" (sc-561), for those who can manage members. */
export function CompanyDomainsCard({
  organisation,
  kind,
}: {
  organisation: Membership;
  kind: LayoutKind;
}) {
  const { t } = useTranslation();
  const [list, setList] = useState<CompanyDomains | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [notRemoved, setNotRemoved] = useState(false);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    let current = true;

    api.companyDomains(organisation.id).then(
      (found) => current && setList(found),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [organisation.id]);

  if (list == null) return null;

  const on = list.domains.some((one) => !one.stopped);
  const full = list.domains.length >= list.most;
  const example = domainOf(list.ownAddress) ?? 'example.com';
  const flashTitle =
    flash?.kind === 'added'
      ? t('companyDomains.added', { domain: flash.domain })
      : t('companyDomains.removed', { domain: flash?.domain ?? '' });
  const flashBody =
    flash?.kind === 'added' ? t('companyDomains.addedNext') : t('companyDomains.removedNext');

  async function add(): Promise<void> {
    if (busy) return;

    const problem = companyDomainProblem(typed);

    if (problem != null) {
      setError(
        problem === 'blank'
          ? t('companyDomains.blank', { example })
          : t('companyDomains.shape', { example }),
      );
      input.current?.focus();
      return;
    }

    setBusy(true);
    setFlash(null);
    setNotRemoved(false);

    try {
      const domain = normaliseDomain(typed);
      setList(await api.addCompanyDomain(organisation.id, domain));
      setTyped('');
      setError(undefined);
      setFlash({ kind: 'added', domain });
    } catch (refusal) {
      const message =
        refusal instanceof ApiError && refusal.is('validation_failed')
          ? refusal.fieldErrors().domain
          : undefined;
      setError(message ?? t('companyDomains.failed'));
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function remove(domain: string): Promise<void> {
    setBusy(true);
    setFlash(null);
    setNotRemoved(false);

    try {
      setList(await api.removeCompanyDomain(organisation.id, domain));
      setFlash({ kind: 'removed', domain });
    } catch {
      setNotRemoved(true);
    } finally {
      setConfirming(null);
      setBusy(false);
    }
  }

  return (
    <View style={cardFrame(kind)}>
      <View style={styles.heading}>
        <Text
          size={tokens.typeRowTitle.size}
          weight="bold"
          accessibilityRole="header"
          style={styles.title}
        >
          {t('companyDomains.title')}
        </Text>
        <StateWord on={on} label={on ? t('companyDomains.on') : t('companyDomains.off')} />
      </View>
      <Text size={tokens.typeBodyPhone.size} muted>
        {t('companyDomains.intro', { organisation: organisation.name })}
      </Text>

      {flash != null && (
        <ReadOut words={`${flashTitle}\n${flashBody}`}>
          <Notice tone="done" mark={tokens.marks.done.glyph} title={flashTitle} body={flashBody} />
        </ReadOut>
      )}

      {notRemoved && <NotRemovedLine words={t('companyDomains.failed')} />}

      {list.domains.map(({ domain, stopped }) => (
        <View key={domain} style={styles.row}>
          <View style={styles.rowHead}>
            <View style={styles.naming}>
              <Text size={tokens.typeRowTitle.size} weight="semibold">
                {domain}
              </Text>
              <StateWord
                on={!stopped}
                label={stopped ? t('companyDomains.stopped') : t('companyDomains.working')}
              />
            </View>
            {confirming !== domain && (
              <SecondaryButton
                label={t('companyDomains.remove')}
                accessibilityLabel={t('companyDomains.removeLabel', { domain })}
                off={busy}
                onPress={() => setConfirming(domain)}
                testID={`companyDomains.remove.${domain}`}
              />
            )}
          </View>
          {stopped && (
            <Text size={tokens.typeSmall.size} muted>
              {t('companyDomains.stoppedBody', { domain })}
            </Text>
          )}
          {confirming === domain && (
            <View style={styles.confirm}>
              <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
                {t('companyDomains.removeTitle', { domain })}
              </Text>
              <Text size={tokens.typeBodyPhone.size}>
                {t('companyDomains.removeBody', { domain })}
              </Text>
              <View style={styles.buttons}>
                <PrimaryButton
                  label={t('companyDomains.removeConfirm', { domain })}
                  busy={busy}
                  onPress={() => void remove(domain)}
                  testID={`companyDomains.confirm.${domain}`}
                />
                <SecondaryButton
                  label={t('companyDomains.keep')}
                  off={busy}
                  onPress={() => setConfirming(null)}
                  testID={`companyDomains.keep.${domain}`}
                />
              </View>
            </View>
          )}
        </View>
      ))}

      {full ? (
        <Text size={tokens.typeSmall.size} muted>
          {t('companyDomains.full', { count: list.most })}
        </Text>
      ) : (
        <>
          <Field
            label={t('companyDomains.addLabel')}
            error={error}
            help={
              list.ownAddress == null
                ? t('companyDomains.helpNoAddress', { count: list.most })
                : t('companyDomains.help', { email: list.ownAddress, count: list.most })
            }
          >
            <TextField
              ref={input}
              wrong={error != null}
              editable={!busy}
              value={typed}
              placeholder={example}
              onChangeText={(text) => {
                setTyped(text);
                setError(undefined);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={() => void add()}
              accessibilityLabel={t('companyDomains.addLabel')}
              testID="companyDomains.domain"
            />
          </Field>
          <PrimaryButton
            label={t('companyDomains.add')}
            busy={busy}
            onPress={() => void add()}
            testID="companyDomains.add"
          />
        </>
      )}
    </View>
  );
}

/** Scrolled into view when it appears, since the removal it answers can sit a screen below it. */
function NotRemovedLine({ words }: { words: string }) {
  const top = useScrolledToTop();

  return (
    <View ref={top}>
      <ReadOut words={words} interrupts accessibilityRole="alert">
        <Notice tone="broken" mark={tokens.marks.broken.glyph} body={words} />
      </ReadOut>
    </View>
  );
}

function StateWord({ on, label }: { on: boolean; label: string }) {
  return (
    <View style={styles.state}>
      <View style={[styles.dot, on ? styles.dotOn : styles.dotOff]} />
      <Text
        size={tokens.typeButton.size}
        weight="semibold"
        style={on ? styles.inkOn : styles.inkOff}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  title: { flex: 1 },
  state: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: tokens.colorAccent },
  dotOff: { borderWidth: 1.5, borderColor: tokens.colorMarkEmpty },
  inkOn: { color: tokens.colorAccentText },
  inkOff: { color: tokens.colorInkSecondary },
  row: {
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceMd,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  rowHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spaceMd,
  },
  naming: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
  confirm: {
    gap: tokens.spaceSm,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
});
