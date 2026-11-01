import { type Membership, type RequestLink } from '@soirely/api-client';
import { setStringAsync } from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { DestructiveButton, PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { AnswerHeading } from './AnswerHeading.tsx';
import { Notice } from './Notice.tsx';
import { OnOffSwitch } from './OnOffSwitch.tsx';
import { ReadOut } from './ReadOut.tsx';
import { type StepClosed, stepClosed, useFocusBackToOpener } from './Screen.tsx';
import { Text } from './Text.tsx';
import { Arrived, Skeleton } from './Skeleton.tsx';

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
  const [unread, setUnread] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  // Replace link's answer, where its step closed: it takes focus in place of being read out (sc-11173).
  const [replaced, setReplaced] = useState<object | null>(null);
  const [closed, setClosed] = useState<StepClosed | undefined>(undefined);
  const opener = useFocusBackToOpener(closed);

  useEffect(() => {
    let current = true;

    api.requestLink(organisation.id).then(
      (found) => current && setLink(found),
      () => current && setUnread(true),
    );

    return () => {
      current = false;
    };
  }, [organisation.id]);

  if (link == null) {
    return unread ? null : (
      <View style={cardFrame(kind)}>
        <Text size={tokens.typeRowTitle.size} weight="bold" accessibilityRole="header">
          {t('requestLink.title')}
        </Text>
        <Skeleton
          words={t('pending.loading')}
          shape="cards"
          cards={[{ lines: 2, fields: 1 }]}
          inCard
        />
      </View>
    );
  }

  async function change(
    next: () => Promise<RequestLink>,
    done: Flash,
    fromStep = false,
  ): Promise<void> {
    if (busy) return;

    setBusy(true);
    setFailed(false);
    setFlash(null);
    setReplaced(null);
    setClosed(undefined);

    try {
      setLink(await next());
      setFlash(done);
    } catch {
      setFailed(true);
    } finally {
      if (fromStep) setReplaced({});
      setConfirming(false);
      setBusy(false);
    }
  }

  async function copy(url: string): Promise<void> {
    setReplaced(null);
    setClosed(undefined);

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
  const changed = flash == null ? null : t(`requestLink.flash.${flash}`);
  const notChanged = t('requestLink.failed');

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
        <Arrived>
          <OnOffSwitch
            on={link.on}
            words={{ on: t('requestLink.on'), off: t('requestLink.off') }}
            label={t('requestLink.switchLabel')}
            disabled={busy}
            busy={busy && !confirming}
            onChange={toggle}
            testID="requestLink.switch"
          />
        </Arrived>
      </View>
      <Arrived style={styles.arrived}>
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('requestLink.intro', { organisation: organisation.name })}
        </Text>

        {changed != null && replaced != null && (
          <Notice
            tone="done"
            mark={tokens.marks.done.glyph}
            body={changed}
            answer={replaced}
            takesFocus
          />
        )}
        {changed != null && replaced == null && (
          <ReadOut words={changed}>
            <Notice tone="done" mark={tokens.marks.done.glyph} body={changed} />
          </ReadOut>
        )}

        {failed && replaced != null && (
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            body={notChanged}
            answer={replaced}
            takesFocus
          />
        )}
        {failed && replaced == null && (
          <ReadOut words={notChanged} interrupts accessibilityRole="alert">
            <Notice tone="broken" mark={tokens.marks.broken.glyph} body={notChanged} />
          </ReadOut>
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
                <AnswerHeading answer={confirming} size={tokens.typeRowTitle.size} weight="bold">
                  {t('requestLink.replaceTitle')}
                </AnswerHeading>
                <Text size={tokens.typeBodyPhone.size}>{t('requestLink.replaceBody')}</Text>
                <View style={styles.buttons}>
                  <QuietButton
                    label={t('requestLink.keep')}
                    off={busy}
                    onPress={() => {
                      setConfirming(false);
                      setClosed(stepClosed('replace'));
                    }}
                    testID="requestLink.keep"
                  />
                  <DestructiveButton
                    label={t('requestLink.replaceConfirm')}
                    busy={busy}
                    onPress={() =>
                      void change(() => api.replaceRequestLink(organisation.id), 'replaced', true)
                    }
                    testID="requestLink.replaceConfirm"
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
                  ref={opener('replace')}
                  label={t('requestLink.replace')}
                  off={busy}
                  onPress={() => {
                    setClosed(undefined);
                    setConfirming(true);
                  }}
                  testID="requestLink.replace"
                />
              </View>
            )}
          </View>
        )}
      </Arrived>
    </View>
  );
}

const styles = StyleSheet.create({
  arrived: { gap: tokens.spaceLg },
  heading: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  title: { flex: 1 },
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
