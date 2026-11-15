import { ApiError, ApiUnreachableError, type RequestLinkPreview } from '@soirely/api-client';
import {
  REQUEST_MESSAGE_MAXIMUM,
  fallsOnLaterDay,
  formatDay,
  formatTimeOfDay,
  lockLiftsAt,
} from '@soirely/domain';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  type TextInputInstance,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, meAtLaunch } from '../../src/api.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from '../../src/components/Buttons.tsx';
import { focusChecked, keysStayDown } from '../../src/components/Field.tsx';
import { Notice } from '../../src/components/Notice.tsx';
import { OrgTile } from '../../src/components/OrgTile.tsx';
import { ProviderButtons } from '../../src/components/ProviderSignIn.tsx';
import { ReadOut } from '../../src/components/ReadOut.tsx';
import { AnswerInView } from '../../src/components/Screen.tsx';
import { Text } from '../../src/components/Text.tsx';
import { PageFrame } from '../../src/components/Welcome.tsx';
import { holdLink } from '../../src/heldLink.ts';
import { dateLocale } from '../../src/i18n/index.ts';
import { useFormChecks } from '../../src/kit/formChecks.ts';
import { InsideField } from '../../src/steps/InsideField.tsx';
import { Heading, Plain, Says, stepTitle, useStepTitleSize } from '../../src/steps/Lines.tsx';
import { NavBar, StepScreen } from '../../src/steps/StepScreen.tsx';
import { tokens } from '../../src/theme/tokens.ts';
import { unreachableFrom } from '../../src/unreachable.ts';

/** An invitation's token is 64 hex characters; the app answers invitations in the product, not by link. */
const REQUEST_LINK_TOKEN = /^[0-9a-f]{32}$/i;

type Shown =
  | { kind: 'loading' }
  | { kind: 'dead'; answer?: object }
  | { kind: 'open'; preview: RequestLinkPreview; signedIn: boolean }
  | { kind: 'sent'; preview: RequestLinkPreview }
  | { kind: 'limited'; preview: RequestLinkPreview; until: Date | null };

function close(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** An organisation's request link (sc-562), `JoinRequest-*`: its name, and Ask to join. */
export default function RequestToJoin() {
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  const [view, setView] = useState<Shown>({ kind: 'loading' });
  const isRequestLink = REQUEST_LINK_TOKEN.test(token);

  useEffect(() => {
    if (!isRequestLink) return;
    let live = true;

    void (async () => {
      const me = await meAtLaunch();

      if ('error' in me && me.error instanceof ApiUnreachableError) {
        if (live) router.replace(unreachableFrom({ kind: 'join', token }));
        return;
      }

      try {
        const preview = await api.requestLinkPreview(token);
        if (live) setView({ kind: 'open', preview, signedIn: 'account' in me });
      } catch (error) {
        if (!live) return;
        if (error instanceof ApiError && error.is('request_link_dead')) setView({ kind: 'dead' });
        else router.replace(unreachableFrom({ kind: 'join', token }));
      }
    })();

    return () => {
      live = false;
    };
  }, [token, isRequestLink]);

  if (!isRequestLink) return <Redirect href="/" />;

  if (view.kind === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  if (view.kind === 'dead') return <Dead answer={view.answer} />;

  if (view.kind === 'open' && !view.signedIn) {
    return <SignedOut token={token} organisation={view.preview.organisation.name} />;
  }

  return <Asking token={token} view={view} onChange={setView} />;
}

const nav = <NavBar left="close" onLeft={close} testID="requestToJoin" />;

/** Unknown, switched off and replaced alike, with no organisation named; `answer` when Ask to join found it so. */
function Dead({ answer }: { answer?: object | undefined }) {
  const { t } = useTranslation();

  return (
    <StepScreen
      nav={nav}
      foot={
        <SecondaryButton
          label={t('requestToJoin.goHome')}
          onPress={() => router.replace('/')}
          testID="requestToJoin.home"
        />
      }
    >
      <Heading title={t('requestToJoin.deadTitle')} answer={answer} />
      <View style={styles.below}>
        <Notice tone="quiet" mark={tokens.marks.info.glyph} body={t('requestToJoin.deadBody')} />
      </View>
    </StepScreen>
  );
}

/** Welcome's four ways in under the organisation's tile; each holds the link, so signing in comes back here. */
function SignedOut({ token, organisation }: { token: string; organisation: string }) {
  const { t } = useTranslation();
  const size = useStepTitleSize();
  // A failed Google or Apple sign-in stays on the link rather than going to welcome (sc-29070).
  const [failed, setFailed] = useState<{ provider: string } | null>(null);

  async function go(to: '/sign-in' | '/register'): Promise<void> {
    await holdLink(token);
    router.push(to);
  }

  return (
    <PageFrame
      top={
        <View style={styles.grow}>
          <NavBar left="close" onLeft={close} testID="requestToJoin" />
        </View>
      }
      brand={
        <View style={styles.brand}>
          <OrgTile name={organisation} size="card" />
          <Text
            size={size}
            weight="bold"
            accessibilityRole="header"
            style={[styles.centre, stepTitle(size)]}
          >
            {t('requestToJoin.title', { organisation })}
          </Text>
          <Text size={tokens.typeBodyPhone.size} style={[styles.centre, styles.secondary]}>
            {t('requestToJoin.signedOutLine')}
          </Text>
        </View>
      }
      choices={
        <View style={styles.choices}>
          {failed != null && (
            <Notice
              tone="broken"
              mark={tokens.marks.broken.glyph}
              title={t('signIn.providerFailedTitle', { provider: failed.provider })}
              body={t('signIn.providerFailedBody', { provider: failed.provider })}
              answer={failed}
              takesFocus
            />
          )}
          <View style={styles.buttons}>
            <PrimaryButton
              label={t('welcome.withEmail')}
              onPress={() => void go('/sign-in')}
              testID="requestToJoin.signIn"
            />
            <ProviderButtons
              before={() => holdLink(token)}
              onFailed={(provider) => setFailed({ provider })}
            />
          </View>
          <QuietButton
            label={t('signIn.createAccount')}
            onPress={() => void go('/register')}
            testID="requestToJoin.register"
          />
        </View>
      }
    />
  );
}

/** Signed in: one screen, the tile and its title over whatever the link has to say. */
function Asking({
  token,
  view,
  onChange,
}: {
  token: string;
  view: Exclude<Shown, { kind: 'loading' | 'dead' }>;
  onChange: (next: Shown) => void;
}) {
  const { t } = useTranslation();
  const { preview } = view;
  const organisation = preview.organisation.name;
  // Where the person stood as the link opened was not an answer to Ask to join, so it is not read out.
  const [opened] = useState(view);
  const top = <Top organisation={organisation} />;

  if (view.kind === 'open' && preview.standing == null) {
    return <Ask token={token} preview={preview} onChange={onChange} top={top} />;
  }

  let body;
  let foot;

  if (view.kind === 'sent') {
    body = (
      <Notice
        tone="done"
        mark={tokens.marks.done.glyph}
        body={t('requestToJoin.sent', { organisation })}
        answer={view}
        takesFocus
      />
    );
    foot = <CarryOn />;
  } else if (view.kind === 'limited') {
    body = (
      <Notice
        tone="attention"
        mark="!"
        body={
          view.until == null
            ? t('requestToJoin.limitedLater')
            : fallsOnLaterDay(view.until)
              ? t('requestToJoin.limitedOnDay', {
                  day: formatDay(view.until, dateLocale()),
                  time: formatTimeOfDay(view.until, dateLocale()),
                })
              : t('requestToJoin.limited', {
                  time: formatTimeOfDay(view.until, dateLocale()),
                })
        }
        answer={view}
        takesFocus
      />
    );
    foot = <CarryOn plain />;
  } else {
    const answer = view === opened ? undefined : view;
    body = (
      <Notice
        tone="quiet"
        mark={tokens.marks.info.glyph}
        body={standingWords(t, preview)}
        answer={answer}
        takesFocus={answer !== undefined}
      />
    );
    foot = (
      <CarryOn
        label={
          preview.standing === 'member' ? t('requestToJoin.open', { organisation }) : undefined
        }
      />
    );
  }

  return (
    <StepScreen nav={nav} foot={foot}>
      {top}
      <View style={styles.below}>{body}</View>
    </StepScreen>
  );
}

function Top({ organisation }: { organisation: string }) {
  const { t } = useTranslation();
  const size = useStepTitleSize();

  return (
    <View style={styles.top}>
      <OrgTile name={organisation} size="card" />
      <Text
        size={size}
        weight="bold"
        accessibilityRole="header"
        style={[styles.title, stepTitle(size)]}
      >
        {t('requestToJoin.title', { organisation })}
      </Text>
    </View>
  );
}

function standingWords(t: ReturnType<typeof useTranslation>['t'], preview: RequestLinkPreview) {
  const organisation = preview.organisation.name;
  const from = preview.askAgainFrom;

  if (preview.standing === 'member') return t('requestToJoin.member', { organisation });
  if (preview.standing === 'waiting') return t('requestToJoin.waiting', { organisation });

  return from == null
    ? t('requestToJoin.coolingOffLater', { organisation })
    : t('requestToJoin.coolingOff', { organisation, date: formatDay(from, dateLocale()) });
}

function Ask({
  token,
  preview,
  onChange,
  top,
}: {
  token: string;
  preview: RequestLinkPreview;
  onChange: (next: Shown) => void;
  top: ReactNode;
}) {
  const { t } = useTranslation();
  const organisation = preview.organisation.name;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<object | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const input = useRef<TextInputInstance>(null);
  // Typing past the most is not stopped (WCAG 2.2 SC 3.3.1): a cut-off paste would lose words unsaid.
  const checks = useFormChecks(
    ['message'] as const,
    (_, value) =>
      Array.from(value.trim()).length > REQUEST_MESSAGE_MAXIMUM
        ? t('requestToJoin.messageLong', { count: REQUEST_MESSAGE_MAXIMUM })
        : null,
    () => focusChecked(input),
  );
  const error = checks.errors.message ?? refused;

  async function ask(): Promise<void> {
    if (busy || !checks.passes({ message })) return;

    keysStayDown();
    setBusy(true);
    setFailed(null);

    try {
      await api.askThroughRequestLink(token, message);
      onChange({ kind: 'sent', preview });
    } catch (problem) {
      setBusy(false);
      settle(problem);
    }
  }

  function settle(problem: unknown): void {
    if (!(problem instanceof ApiError)) {
      setFailed({});
      return;
    }

    // Replaced, switched off or deleted since the screen opened: every try would be refused alike (sc-11741).
    if (problem.is('request_link_dead')) {
      Keyboard.dismiss();
      onChange({ kind: 'dead', answer: {} });
      return;
    }

    if (problem.is('too_many_attempts')) {
      const until = lockLiftsAt(Number(problem.response?.headers.get('Retry-After')));
      onChange({ kind: 'limited', preview, until });
      return;
    }

    const standing = problem.is('already_a_member')
      ? 'member'
      : problem.is('join_request_waiting')
        ? 'waiting'
        : problem.is('join_request_cooling_off')
          ? 'cooling_off'
          : null;

    if (standing != null) {
      const until = problem.problem.until;
      onChange({
        kind: 'open',
        signedIn: true,
        preview: {
          ...preview,
          standing,
          askAgainFrom: typeof until === 'string' ? until : preview.askAgainFrom,
        },
      });
      return;
    }

    if (problem.is('validation_failed')) {
      setRefused(problem.fieldErrors().message ?? null);
      return;
    }

    setFailed({});
  }

  const failedTitle = t('requestToJoin.failedTitle');
  const failedBody = t('requestToJoin.failedBody');

  return (
    <StepScreen
      nav={nav}
      foot={
        <PrimaryButton
          label={busy ? t('requestToJoin.asking') : t('requestToJoin.ask')}
          busy={busy}
          onPress={() => void ask()}
          testID="requestToJoin.ask"
        />
      }
    >
      {top}
      {failed != null && (
        <View style={styles.below}>
          <AnswerInView>
            <ReadOut
              words={`${failedTitle}\n${failedBody}`}
              interrupts
              answer={failed}
              accessibilityRole="alert"
            >
              <Notice
                tone="broken"
                mark={tokens.marks.broken.glyph}
                title={failedTitle}
                body={failedBody}
              />
            </ReadOut>
          </AnswerInView>
        </View>
      )}
      <View style={styles.below}>
        <InsideField
          ref={input}
          label={t('requestToJoin.messageOptional')}
          value={message}
          onChangeText={(text) => {
            setMessage(text);
            setRefused(null);
            checks.edited('message', text);
          }}
          onBlur={() => checks.left('message', message)}
          state={error != null ? 'blank' : 'plain'}
          line={error}
          submitting={busy}
          multiline
          autoCapitalize="sentences"
          testID="requestToJoin.message"
        />
        {error != null && <Says words={error} />}
      </View>
      <Plain>
        {t('requestToJoin.messageHelp', {
          count: REQUEST_MESSAGE_MAXIMUM,
          length: Array.from(message.trim()).length,
        })}
      </Plain>
      <Plain top={tokens.spaceXl} ink>
        {t('requestToJoin.whatTheySee', { organisation })}
      </Plain>
    </StepScreen>
  );
}

/** Launch decides where the account belongs: a gate, the wait for approval, or the app. */
function CarryOn({ label, plain = false }: { label?: string | undefined; plain?: boolean }) {
  const { t } = useTranslation();
  const Button = plain ? SecondaryButton : PrimaryButton;

  return (
    <Button
      label={label ?? t('requestToJoin.carryOn')}
      onPress={() => router.replace('/')}
      testID="requestToJoin.carryOn"
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  brand: { alignItems: 'center', gap: tokens.spaceLg, maxWidth: 340 },
  centre: { textAlign: 'center' },
  secondary: { color: tokens.colorInkSecondary },
  choices: { gap: tokens.spaceSm },
  buttons: { gap: tokens.spaceLg },
  top: {
    marginTop: tokens.spaceLg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  title: { flex: 1 },
  below: { marginTop: tokens.space3xl },
});
