import { ApiError, ApiUnreachableError, type RequestLinkPreview } from '@soirely/api-client';
import {
  REQUEST_MESSAGE_MAXIMUM,
  fallsOnLaterDay,
  formatDay,
  formatTimeOfDay,
  lockLiftsAt,
} from '@soirely/domain';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, meAtLaunch } from '../../src/api.ts';
import { AuthFrame, AuthHeading } from '../../src/components/AuthFrame.tsx';
import { PrimaryButton, SecondaryButton } from '../../src/components/Buttons.tsx';
import { Field, TextField } from '../../src/components/Field.tsx';
import { Notice } from '../../src/components/Notice.tsx';
import { ReadOut } from '../../src/components/ReadOut.tsx';
import { Text } from '../../src/components/Text.tsx';
import { holdLink } from '../../src/heldLink.ts';
import { dateLocale } from '../../src/i18n/index.ts';
import { useFormChecks } from '../../src/kit/formChecks.ts';
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
        if (live) router.replace(unreachableFrom(token));
        return;
      }

      try {
        const preview = await api.requestLinkPreview(token);
        if (live) setView({ kind: 'open', preview, signedIn: 'account' in me });
      } catch (error) {
        if (!live) return;
        if (error instanceof ApiError && error.is('request_link_dead')) setView({ kind: 'dead' });
        else router.replace(unreachableFrom(token));
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

  return (
    <AuthFrame>
      {view.kind === 'dead' ? (
        <Dead answer={view.answer} />
      ) : (
        <Asking token={token} view={view} onChange={setView} />
      )}
    </AuthFrame>
  );
}

/** Unknown, switched off and replaced alike, with no organisation named; `answer` when Ask to join found it so. */
function Dead({ answer }: { answer?: object | undefined }) {
  const { t } = useTranslation();

  return (
    <>
      <AuthHeading title={t('requestToJoin.deadTitle')} answer={answer} />
      <Notice tone="quiet" mark={tokens.marks.info.glyph} body={t('requestToJoin.deadBody')} />
      <SecondaryButton
        label={t('requestToJoin.goHome')}
        onPress={() => router.replace('/')}
        testID="requestToJoin.home"
      />
    </>
  );
}

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

  return (
    <>
      <AuthHeading title={t('requestToJoin.title', { organisation })} />
      <View style={styles.org}>
        <Text size={tokens.typeRowTitle.size} weight="bold">
          {organisation}
        </Text>
        <Text size={tokens.typeSmall.size} muted>
          {t('requestToJoin.requestLink')}
        </Text>
      </View>

      {view.kind === 'sent' && (
        <>
          <Notice
            tone="done"
            mark={tokens.marks.done.glyph}
            body={t('requestToJoin.sent', { organisation })}
            answer={view}
            takesFocus
          />
          <CarryOn />
        </>
      )}
      {view.kind === 'limited' && (
        <>
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
          <CarryOn />
        </>
      )}
      {view.kind === 'open' && !view.signedIn && (
        <SignedOut token={token} organisation={organisation} />
      )}
      {view.kind === 'open' && view.signedIn && preview.standing != null && (
        <Standing preview={preview} answer={view === opened ? undefined : view} />
      )}
      {view.kind === 'open' && view.signedIn && preview.standing == null && (
        <Ask token={token} preview={preview} onChange={onChange} />
      )}
    </>
  );
}

function SignedOut({ token, organisation }: { token: string; organisation: string }) {
  const { t } = useTranslation();

  // Either way, the link is held so the sign-in or the new account comes back here.
  async function go(to: '/sign-in' | '/register'): Promise<void> {
    await holdLink(token);
    router.push(to);
  }

  return (
    <>
      <Text size={tokens.typeBodyPhone.size}>{t('requestToJoin.signedOut', { organisation })}</Text>
      <PrimaryButton
        label={t('requestToJoin.signIn')}
        onPress={() => void go('/sign-in')}
        testID="requestToJoin.signIn"
      />
      <SecondaryButton
        label={t('requestToJoin.register')}
        onPress={() => void go('/register')}
        testID="requestToJoin.register"
      />
    </>
  );
}

function Ask({
  token,
  preview,
  onChange,
}: {
  token: string;
  preview: RequestLinkPreview;
  onChange: (next: Shown) => void;
}) {
  const { t } = useTranslation();
  const organisation = preview.organisation.name;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<object | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const input = useRef<TextInput>(null);
  const checks = useFormChecks(
    ['message'] as const,
    (_, value) =>
      Array.from(value.trim()).length > REQUEST_MESSAGE_MAXIMUM
        ? t('requestToJoin.messageLong', { count: REQUEST_MESSAGE_MAXIMUM })
        : null,
    () => input.current?.focus(),
  );
  const error = checks.errors.message ?? refused;

  async function ask(): Promise<void> {
    if (busy || !checks.passes({ message })) return;

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
    <>
      {failed != null && (
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
      )}
      <Field
        label={t('requestToJoin.message')}
        pill={t('requestToJoin.optional')}
        error={error}
        help={t('requestToJoin.messageHelp', {
          count: REQUEST_MESSAGE_MAXIMUM,
          length: Array.from(message.trim()).length,
        })}
      >
        <TextField
          ref={input}
          wrong={error != null}
          editable={!busy}
          value={message}
          multiline
          numberOfLines={4}
          style={styles.message}
          onChangeText={(text) => {
            setMessage(text);
            setRefused(null);
            checks.edited('message', text);
          }}
          onBlur={() => checks.left('message', message)}
          accessibilityLabel={t('requestToJoin.message')}
          testID="requestToJoin.message"
        />
      </Field>
      <PrimaryButton
        label={busy ? t('requestToJoin.asking') : t('requestToJoin.ask')}
        busy={busy}
        onPress={() => void ask()}
        testID="requestToJoin.ask"
      />
      <Text size={tokens.typeSmall.size} muted>
        {t('requestToJoin.whatTheySee', { organisation })}
      </Text>
    </>
  );
}

function Standing({ preview, answer }: { preview: RequestLinkPreview; answer: Shown | undefined }) {
  const { t } = useTranslation();
  const organisation = preview.organisation.name;
  const from = preview.askAgainFrom;
  const body =
    preview.standing === 'member'
      ? t('requestToJoin.member', { organisation })
      : preview.standing === 'waiting'
        ? t('requestToJoin.waiting', { organisation })
        : from == null
          ? t('requestToJoin.coolingOffLater', { organisation })
          : t('requestToJoin.coolingOff', {
              organisation,
              date: formatDay(from, dateLocale()),
            });

  return (
    <>
      <Notice
        tone="quiet"
        mark={tokens.marks.info.glyph}
        body={body}
        answer={answer}
        takesFocus={answer !== undefined}
      />
      <CarryOn
        label={
          preview.standing === 'member' ? t('requestToJoin.open', { organisation }) : undefined
        }
      />
    </>
  );
}

/** Launch decides where the account belongs: a gate, the wait for approval, or the app. */
function CarryOn({ label }: { label?: string | undefined }) {
  const { t } = useTranslation();

  return (
    <PrimaryButton
      label={label ?? t('requestToJoin.carryOn')}
      onPress={() => router.replace('/')}
      testID="requestToJoin.carryOn"
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  org: { gap: tokens.spaceXs },
  message: { minHeight: 112, textAlignVertical: 'top' },
});
