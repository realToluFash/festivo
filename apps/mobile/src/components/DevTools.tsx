import { type Health } from '@soirely/api-client';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { config } from '../config.ts';
import { DemoButton, demoHere } from '../demo/DemoEntry.tsx';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { Notice } from './Notice.tsx';
import { GlyphMark, type Mark } from './StatusMark.tsx';
import { Text } from './Text.tsx';

type State = { kind: 'loading' } | { kind: 'ok'; health: Health } | { kind: 'failed' };

const ATTENTION: Mark = {
  glyph: '!',
  fill: tokens.colorAttentionWash,
  ring: tokens.colorAttention,
  ink: tokens.colorAttentionText,
};

const BROKEN: Mark = {
  glyph: '!',
  fill: tokens.colorBrokenTint,
  ring: tokens.colorBroken,
  ink: tokens.colorBrokenText,
};

/** For developers: whether the API answers, and the design demo beside it (sc-29076). */
export function DevTools() {
  const { kind } = useLayout();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  const { t } = useTranslation();

  useEffect(() => {
    if (!demoHere()) return;
    let live = true;

    api
      .health()
      .then((health) => {
        if (live) setState({ kind: 'ok', health });
      })
      .catch(() => {
        // The thrown message names a host and a port, which is internal detail.
        if (live) setState({ kind: 'failed' });
      });

    return () => {
      live = false;
    };
  }, [attempt]);

  if (!demoHere()) return null;

  return (
    <View style={styles.devTools}>
      {/* Said out loud rather than left to be discovered on a device, where the
          symptom is a request that times out with no explanation. */}
      {config.usingFallbackApiUrl && (
        <Notice tone="attention" mark={ATTENTION.glyph} body={t('status.usingFallback')} />
      )}
      <View style={cardFrame(kind)}>
        <Text size={tokens.typeTitleSection.size} weight="bold">
          {t('status.title')}
        </Text>
        <HealthCheck state={state} onRetry={retry} />
      </View>
      <DemoButton />
    </View>
  );
}

function HealthCheck({ state, onRetry }: { state: State; onRetry: () => void }) {
  const { t } = useTranslation();

  if (state.kind === 'loading') {
    return (
      <View style={styles.line}>
        <ActivityIndicator color={tokens.colorAccent} />
        <Text size={tokens.typeBodyPhone.size} muted>
          {t('status.checking')}
        </Text>
      </View>
    );
  }

  if (state.kind === 'failed') {
    return (
      <Notice
        tone="broken"
        mark={BROKEN.glyph}
        body={t('status.unreachable')}
        announce
        interrupts
        button={<SecondaryButton label={t('status.retry')} onPress={onRetry} testID="home.retry" />}
      />
    );
  }

  const healthy = state.health.status === 'ok';

  return (
    <View style={styles.checks}>
      <View style={styles.line}>
        <GlyphMark mark={healthy ? tokens.marks.done : ATTENTION} />
        <Text size={tokens.typeBodyPhone.size} weight="semibold">
          {healthy ? t('status.healthy') : t('status.degraded')}
        </Text>
      </View>
      {/* Names and statuses are the API's own words, untranslated; a check's error text is never shown. */}
      {Object.entries(state.health.checks).map(([name, check]) => {
        const ok = check.status === 'ok';

        return (
          <View key={name} style={styles.check}>
            <Text size={tokens.typeSmall.size} style={styles.checkName}>
              {name}
            </Text>
            <View style={[styles.line, styles.checkStatus]}>
              <GlyphMark mark={ok ? tokens.marks.done : BROKEN} />
              <Text
                size={tokens.typeSmall.size}
                weight="semibold"
                style={ok ? styles.okInk : styles.brokenInk}
              >
                {check.status}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  devTools: { marginTop: tokens.spaceXl, gap: tokens.spaceLg },
  line: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  checks: { gap: tokens.spaceXs },
  check: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  checkName: { flexShrink: 1, color: tokens.colorInkSecondary },
  checkStatus: { flexShrink: 0 },
  brokenInk: { color: tokens.colorBrokenText },
  okInk: { color: tokens.colorAccentText },
});
