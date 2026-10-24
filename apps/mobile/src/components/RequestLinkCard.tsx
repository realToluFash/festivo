import { type Membership, type RequestLink } from '@soirely/api-client';
import { setStringAsync } from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';

type Flash = 'on' | 'off' | 'replaced' | 'copied' | null;

/** Settings > Organisation's "Requests to join" (sc-562), for those who can manage members: off until turned on. */
export function RequestLinkCard({
  organisation,
  kind,
}: {
  organisation: Membership;
  kind: LayoutKind;
}) {
  const { t } = useTranslation();
  const [link, setLink] = useState<RequestLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  useEffect(() => {
    let current = true;

    api.requestLink(organisation.id).then(
      (found) => current && setLink(found),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [organisation.id]);

  if (link == null) return null;

  async function change(next: () => Promise<RequestLink>, done: Flash): Promise<void> {
    if (busy) return;

    setBusy(true);
    setFailed(false);
    setFlash(null);

    try {
      setLink(await next());
      setFlash(done);
    } catch {
      setFailed(true);
    } finally {
      setConfirming(false);
      setBusy(false);
    }
  }

  async function copy(url: string): Promise<void> {
    try {
      await setStringAsync(url);
      setFlash('copied');
    } catch {
      setFailed(true);
    }
  }

  const toggle = (): void =>
    void (link.on
      ? change(() => api.turnOffRequestLink(organisation.id), 'off')
      : change(() => api.turnOnRequestLink(organisation.id), 'on'));

  return (
    <View style={cardFrame(kind)}>
      <View style={styles.heading}>
        <Text
          size={tokens.typeRowTitle.size}
          weight="bold"
          accessibilityRole="header"
          style={styles.title}
        >
          {t('requestLink.title')}
        </Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={t('requestLink.switchLabel')}
          accessibilityState={{ checked: link.on, disabled: busy, busy: busy && !confirming }}
          disabled={busy}
          onPress={toggle}
          hitSlop={tokens.spaceSm}
          style={[styles.switch, link.on && styles.switchOn]}
          testID="requestLink.switch"
        >
          <View style={[styles.dot, link.on ? styles.dotOn : styles.dotOff]} />
          <Text
            size={tokens.typeButton.size}
            weight="semibold"
            style={link.on ? styles.inkOn : styles.inkOff}
          >
            {link.on ? t('requestLink.on') : t('requestLink.off')}
          </Text>
        </Pressable>
      </View>
      <Text size={tokens.typeBodyPhone.size} muted>
        {t('requestLink.intro', { organisation: organisation.name })}
      </Text>

      {flash != null && (
        <View accessibilityLiveRegion="polite">
          <Notice
            tone="done"
            mark={tokens.marks.done.glyph}
            body={t(`requestLink.flash.${flash}`)}
          />
        </View>
      )}

      {failed && (
        <View accessibilityLiveRegion="assertive" accessibilityRole="alert">
          <Notice tone="broken" mark={tokens.marks.broken.glyph} body={t('requestLink.failed')} />
        </View>
      )}

      {link.on && link.url != null && (
        <View style={styles.link}>
          <Text size={tokens.typeSmall.size} weight="semibold">
            {t('requestLink.linkLabel')}
          </Text>
          <View style={styles.url}>
            <Text size={tokens.typeBodyPhone.size} selectable testID="requestLink.url">
              {link.url}
            </Text>
          </View>
          <Text size={tokens.typeSmall.size} muted>
            {t('requestLink.help')}
          </Text>
          {confirming ? (
            <View style={styles.confirm}>
              <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
                {t('requestLink.replaceTitle')}
              </Text>
              <Text size={tokens.typeBodyPhone.size}>{t('requestLink.replaceBody')}</Text>
              <View style={styles.buttons}>
                <PrimaryButton
                  label={t('requestLink.replaceConfirm')}
                  busy={busy}
                  onPress={() =>
                    void change(() => api.replaceRequestLink(organisation.id), 'replaced')
                  }
                  testID="requestLink.replaceConfirm"
                />
                <SecondaryButton
                  label={t('requestLink.keep')}
                  off={busy}
                  onPress={() => setConfirming(false)}
                  testID="requestLink.keep"
                />
              </View>
            </View>
          ) : (
            <View style={styles.buttons}>
              <PrimaryButton
                label={t('requestLink.copy')}
                onPress={() => void copy(link.url ?? '')}
                testID="requestLink.copy"
              />
              <SecondaryButton
                label={t('requestLink.replace')}
                off={busy}
                onPress={() => setConfirming(true)}
                testID="requestLink.replace"
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  title: { flex: 1 },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  switchOn: { backgroundColor: tokens.colorAccentTint },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: tokens.colorAccent },
  dotOff: { borderWidth: 1.5, borderColor: tokens.colorMarkEmpty },
  inkOn: { color: tokens.colorAccentText },
  inkOff: { color: tokens.colorInkSecondary },
  link: { gap: tokens.spaceSm },
  url: {
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
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
