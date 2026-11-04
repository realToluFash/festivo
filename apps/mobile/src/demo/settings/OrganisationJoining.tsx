import { normaliseDomain } from '@soirely/domain';
import { setStringAsync } from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import {
  Field,
  focusChecked,
  focusRefused,
  keysStayDown,
  TextField,
} from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { useShownAfter } from '../../components/useShownAfter.ts';
import { SKELETON_AFTER_MS } from '../../kit/skeleton.ts';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { ConfettiSwitch } from './NotificationsSwitch.tsx';
import {
  DOMAINS_MOST,
  domainProblem,
  domainRefusal,
  LOADING_MS,
  type OrganisationState,
  requestLink,
  RETRY_MS,
  SEND_MS,
  YOUR_DOMAIN,
} from './OrganisationModel.ts';
import { DOMAIN_WORDS as D, LINK_WORDS as L, LOADING, TRY_AGAIN } from './OrganisationWords.ts';
import { Card, CardHead, Chip, Pair, Pill, TYPE } from './parts.tsx';
import type { SettingsLayout } from './sample.ts';

type Flash = { title: string; body: string; tap: object } | null;
type Told = { words: string; tap: object } | null;

/** One timer at a time per card, cleared when the card goes. */
function useLater() {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (ms: number, then: () => void) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(then, ms);
  };
}

export function DomainsCard({
  start,
  layout,
}: {
  start: OrganisationState | null;
  layout: SettingsLayout;
}) {
  const phone = layout === 'phone';
  const later = useLater();
  const [loading, setLoading] = useState(start === 'cardsLoading');
  const [domains, setDomains] = useState<string[]>([YOUR_DOMAIN]);
  const [confirming, setConfirming] = useState<string | null>(
    start === 'removeDomain' ? YOUR_DOMAIN : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [added, setAdded] = useState(0);
  const typed = useRef('');
  const input = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), LOADING_MS);

    return () => clearTimeout(timer);
  }, [loading]);

  const head = (
    <CardHead
      title={D.title}
      {...(loading ? {} : { line: D.intro })}
      right={
        loading ? undefined : domains.length > 0 ? (
          <Chip word={D.on} kind="active" />
        ) : (
          <Chip word={D.off} kind="former" />
        )
      }
    />
  );

  if (loading)
    return (
      <Card>
        {head}
        <CardLoading />
      </Card>
    );

  function add(): void {
    if (busy) return;
    const problem = domainProblem(typed.current);
    setFlash(null);
    setError(problem);
    if (problem != null) {
      focusChecked(input);
      return;
    }

    keysStayDown();
    setBusy(true);
    later(SEND_MS, () => {
      setBusy(false);
      const refusal = domainRefusal(typed.current, domains);
      if (refusal != null) {
        setError(refusal);
        focusRefused(input);
        return;
      }
      const domain = normaliseDomain(typed.current);
      setDomains((listed) => [...listed, domain]);
      setFlash({ title: D.added(domain), body: D.addedNext, tap: {} });
      typed.current = '';
      setAdded((count) => count + 1);
    });
  }

  function remove(domain: string): void {
    setBusy(true);
    later(SEND_MS, () => {
      setBusy(false);
      setConfirming(null);
      setDomains((listed) => listed.filter((other) => other !== domain));
      setFlash({ title: D.removed(domain), body: D.removedNext, tap: {} });
    });
  }

  return (
    <Card>
      {head}
      {flash != null && (
        <Notice
          tone="done"
          mark={tokens.marks.done.glyph}
          title={flash.title}
          body={flash.body}
          answer={flash.tap}
        />
      )}
      {domains.map((domain) => {
        const open = confirming === domain;
        const removeButton = open ? null : (
          <Pill
            label={D.remove}
            kind="dangerQuiet"
            height={tokens.sizeHit}
            full={false}
            onPress={() => {
              setFlash(null);
              setConfirming(domain);
            }}
            accessibilityLabel={D.removeLabel(domain)}
            testID={`demo.organisation.domain.${domain}.remove`}
          />
        );
        const state = <Chip word={D.working} kind="active" />;

        return (
          <View key={domain} style={styles.panel}>
            <View style={styles.panelHead}>
              <Text size={17} weight="semibold" style={phone ? styles.grow : undefined}>
                {domain}
              </Text>
              {!phone && state}
              {!phone && <View style={styles.grow} />}
              {removeButton}
            </View>
            {phone && state}
            {open && (
              <View style={styles.step}>
                <Text size={17} weight="bold" accessibilityRole="header">
                  {D.removeTitle(domain)}
                </Text>
                <Text size={TYPE.body} weight="medium">
                  {D.removeBody(domain)}
                </Text>
                <Pair
                  layout={layout}
                  dismiss={
                    <Pill
                      label={D.keep}
                      kind="secondary"
                      full={phone}
                      onPress={() => setConfirming(null)}
                      testID="demo.organisation.domain.keep"
                    />
                  }
                  confirm={
                    <Pill
                      label={D.removeLabel(domain)}
                      kind="danger"
                      full={phone}
                      onPress={() => {
                        if (!busy) remove(domain);
                      }}
                      testID="demo.organisation.domain.confirm"
                    />
                  }
                />
              </View>
            )}
          </View>
        );
      })}
      <Field label={D.addLabel} error={error} help={D.help(SAMPLE.email, DOMAINS_MOST)}>
        <TextField
          key={added}
          ref={input}
          defaultValue=""
          placeholder={YOUR_DOMAIN}
          onChangeText={(text) => {
            typed.current = text;
            if (error != null && domainProblem(text) == null) setError(null);
          }}
          wrong={error != null}
          submitting={busy}
          keyboardType="url"
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={add}
          submitBehavior="submit"
          accessibilityLabel={D.addLabel}
          testID="demo.organisation.domain.add"
        />
      </Field>
      <Pill label={D.add} onPress={add} full={phone} testID="demo.organisation.domain.send" />
    </Card>
  );
}

export function RequestsCard({
  start,
  layout,
}: {
  start: OrganisationState | null;
  layout: SettingsLayout;
}) {
  const phone = layout === 'phone';
  const later = useLater();
  const [status, setStatus] = useState<'loaded' | 'loading' | 'failed'>(
    start === 'cardsLoading' ? 'failed' : 'loaded',
  );
  const [on, setOn] = useState(true);
  const [made, setMade] = useState(0);
  const [confirming, setConfirming] = useState(start === 'removeDomain');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Told>(null);
  const link = requestLink(made);

  function turn(next: boolean): void {
    setFlash(null);
    setBusy(true);
    later(SEND_MS, () => {
      setBusy(false);
      setOn(next);
      setConfirming(false);
      if (next) setMade((count) => count + 1);
      setFlash({ words: next ? L.on : L.off, tap: {} });
    });
  }

  function replace(): void {
    setBusy(true);
    later(SEND_MS, () => {
      setBusy(false);
      setConfirming(false);
      setMade((count) => count + 1);
      setFlash({ words: L.replaced, tap: {} });
    });
  }

  if (status !== 'loaded')
    return (
      <Card>
        <CardHead title={L.title} />
        {status === 'loading' ? (
          <CardLoading />
        ) : (
          <>
            <Notice tone="broken" mark={tokens.marks.broken.glyph} body={L.unreadable} />
            <Pill
              label={TRY_AGAIN}
              kind="secondary"
              height={tokens.sizeHit}
              full={false}
              onPress={() => {
                setStatus('loading');
                later(RETRY_MS, () => setStatus('loaded'));
              }}
              testID="demo.organisation.link.tryAgain"
            />
          </>
        )}
      </Card>
    );

  return (
    <Card>
      <CardHead
        title={L.title}
        line={L.intro}
        right={
          <ConfettiSwitch
            on={on}
            label={L.title}
            busy={busy}
            onChange={turn}
            testID="demo.organisation.link.switch"
          />
        }
      />
      {flash != null && (
        <Notice tone="done" mark={tokens.marks.done.glyph} body={flash.words} answer={flash.tap} />
      )}
      {on && (
        <View style={styles.link}>
          <Text size={14} weight="semibold">
            {L.linkLabel}
          </Text>
          <View style={styles.url}>
            <Text size={TYPE.row} weight="medium" selectable>
              {link}
            </Text>
          </View>
          <Text size={TYPE.small} weight="medium" muted>
            {L.help}
          </Text>
        </View>
      )}
      {on && confirming && (
        <View style={styles.step}>
          <Text size={17} weight="bold" accessibilityRole="header">
            {L.replaceTitle}
          </Text>
          <Text size={TYPE.body} weight="medium">
            {L.replaceBody}
          </Text>
          <Pair
            layout={layout}
            dismiss={
              <Pill
                label={L.keep}
                kind="secondary"
                full={phone}
                onPress={() => setConfirming(false)}
                testID="demo.organisation.link.keep"
              />
            }
            confirm={
              <Pill
                label={L.replaceConfirm}
                kind="danger"
                full={phone}
                onPress={() => {
                  if (!busy) replace();
                }}
                testID="demo.organisation.link.confirm"
              />
            }
          />
        </View>
      )}
      {on && !confirming && (
        <View style={phone ? styles.buttonsPhone : styles.buttonsTablet}>
          <Pill
            label={L.copy}
            glyph="copy"
            full={phone}
            height={phone ? tokens.sizeHitPhoneHero : tokens.sizeHitPhonePrimary}
            onPress={() => {
              void setStringAsync(link).then(() => setFlash({ words: L.copied, tap: {} }));
            }}
            testID="demo.organisation.link.copy"
          />
          <Pill
            label={L.replace}
            kind="dangerQuiet"
            full={false}
            height={phone ? tokens.sizeHit : tokens.sizeHitPhonePrimary}
            onPress={() => {
              setFlash(null);
              setConfirming(true);
            }}
            testID="demo.organisation.link.replace"
          />
        </View>
      )}
    </Card>
  );
}

/** A card's own Loading…, after a second, over the shape of two lines and a field. */
function CardLoading() {
  const shown = useShownAfter(SKELETON_AFTER_MS);
  useReadOut(shown ? LOADING : null);

  return (
    <View accessibilityState={{ busy: true }} style={styles.loading}>
      {shown && (
        <Text size={TYPE.line} weight="medium" muted>
          {LOADING}
        </Text>
      )}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.loading, !shown && styles.unseen]}
      >
        <View style={styles.bars}>
          <View style={[styles.bar, styles.barLong]} />
          <View style={[styles.bar, styles.barShort]} />
        </View>
        <View style={styles.bars}>
          <View style={[styles.bar, styles.barLabel]} />
          <View style={styles.fieldShape} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  panel: {
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: 14,
    borderRadius: 18,
    backgroundColor: tokens.colorCard,
  },
  panelHead: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  step: {
    gap: tokens.spaceLg,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  link: { gap: 7 },
  url: {
    paddingVertical: 14,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  buttonsPhone: { gap: tokens.spaceMd },
  buttonsTablet: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceMd },
  loading: { gap: 14 },
  unseen: { opacity: 0 },
  bars: { gap: 9 },
  bar: { height: 13, borderRadius: 6, backgroundColor: tokens.colorInsetBorder },
  barLong: { width: '92%' },
  barShort: { width: '70%' },
  barLabel: { width: '34%' },
  fieldShape: { height: 52, borderRadius: 14, backgroundColor: tokens.colorInsetBorder },
});
