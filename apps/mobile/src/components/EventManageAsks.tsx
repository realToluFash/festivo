import type { OrganisationEvent } from '@soirely/api-client';
import { changedWords, cleanThankYou, thankYouOver } from '@soirely/domain';
import { type RefObject, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import {
  type EndRefusal,
  type PauseRefusal,
  endRefusalOf,
  pauseRefusalOf,
} from '../kit/makeLive.ts';
import { useLifecycleAction } from './LifecycleSheet.tsx';
import { ThankYouField } from './ThankYou.tsx';
import { tokens } from '../theme/tokens.ts';
import { Ask, ASK_WIDTH } from './Summary.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';

type Opener = RefObject<ScreenReaderTarget | null>;
type End = 'callOff' | 'endNow';

/** Pause, Call off and End now from Manage: the question, then the reason in its place when the server refuses. */
export function useManageAsks({
  event,
  onChange,
  openers,
  onThanked,
}: {
  event: OrganisationEvent;
  onChange: (event: OrganisationEvent) => void;
  openers: { pause: Opener; end: Opener };
  /** End now went with a thank-you (sc-6476). */
  onThanked?: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [tried, setTried] = useState(false);
  const pause = useLifecycleAction<object, PauseRefusal>({
    event,
    onChange,
    refusalOf: pauseRefusalOf,
  });
  const end = useLifecycleAction<{ label: End }, EndRefusal>({
    event,
    onChange,
    refusalOf: endRefusalOf,
    onDone: () => {
      if (cleanThankYou(draft) !== '') onThanked?.();
    },
  });

  return {
    askPause: () => pause.ask({}),
    askEnd: (label: End) => {
      setDraft('');
      setTried(false);
      end.ask({ label });
    },
    asks: (
      <>
        <PauseAsk event={event} action={pause} opener={openers.pause} />
        <EndAsk
          event={event}
          action={end}
          opener={openers.end}
          draft={draft}
          tried={tried}
          onType={(typed) => {
            setDraft(typed);
            setTried((was) => was && thankYouOver(typed));
          }}
          onOver={() => setTried(true)}
        />
      </>
    ),
  };
}

type PauseAction = ReturnType<typeof useLifecycleAction<object, PauseRefusal>>;
type EndAction = ReturnType<typeof useLifecycleAction<{ label: End }, EndRefusal>>;

function useChangedLine(event: OrganisationEvent): string {
  const { t } = useTranslation();

  return changedWords(event)
    .map((line) => t(line))
    .join(' ');
}

function PauseAsk({
  event,
  action,
  opener,
}: {
  event: OrganisationEvent;
  action: PauseAction;
  opener: Opener;
}) {
  const { t } = useTranslation();
  const changed = useChangedLine(event);
  const { asking, go, close } = action;

  return (
    <Ask
      open={asking != null}
      opener={opener}
      width={ASK_WIDTH}
      onKeep={close}
      onConfirm={() => go({}, () => api.pauseEvent(event.id))}
      testID="events.pauseSheet"
      {...(asking == null || asking.kind === 'confirm'
        ? {
            title: t('eventPause.title', { name: event.name }),
            line: t('eventPage.pauseLine'),
            keep: {
              label: t('eventPause.keepItLive'),
              off: asking?.pending === true,
              testID: 'events.pauseNo',
            },
            confirm: {
              label: t('eventPause.pause'),
              busy: asking?.pending === true ? t('eventPause.pausing') : undefined,
              testID: 'events.pauseYes',
            },
            failed: asking?.failed === true ? t('eventPause.failed') : null,
          }
        : {
            title: t('eventPause.notPaused'),
            line: changed,
            alert: true,
            keep: { label: t('eventLive.close'), testID: 'events.pauseClose' },
            confirm: null,
          })}
    />
  );
}

function EndAsk({
  event,
  action,
  opener,
  draft,
  tried,
  onType,
  onOver,
}: {
  event: OrganisationEvent;
  action: EndAction;
  opener: Opener;
  draft: string;
  tried: boolean;
  onType: (typed: string) => void;
  onOver: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [typing, setTyping] = useState(false);
  const changed = useChangedLine(event);
  const { asking, go, close } = action;
  const callOff = asking?.kind === 'confirm' && asking.label === 'callOff';
  const thanks = asking?.kind === 'confirm' && !callOff;
  const thanked = cleanThankYou(draft) !== '';

  return (
    <Ask
      open={asking != null}
      opener={opener}
      width={ASK_WIDTH}
      onKeep={close}
      onConfirm={() => {
        if (asking?.kind !== 'confirm') return;
        if (thanks && thankYouOver(draft)) {
          onOver();
          return;
        }
        go({ label: asking.label }, () =>
          thanks ? api.endEvent(event.id, cleanThankYou(draft)) : api.endEvent(event.id),
        );
      }}
      testID="events.endSheet"
      {...(asking == null || asking.kind === 'confirm'
        ? {
            title: t(callOff ? 'eventEnd.callOffTitle' : 'eventEnd.endTitle', { name: event.name }),
            line: t(callOff ? 'eventPage.callOffLine' : 'eventPage.endLine'),
            keep: {
              label: t('eventEnd.keepItOn'),
              off: asking?.pending === true,
              testID: 'events.endNo',
            },
            confirm: {
              label: t(callOff ? 'eventEnd.callOff' : 'eventEnd.endNow'),
              removes: true,
              busy:
                asking?.pending === true
                  ? t(callOff ? 'eventEnd.callingOff' : 'eventEnd.ending')
                  : undefined,
              testID: 'events.endYes',
            },
            failed:
              asking?.failed === true
                ? t(
                    callOff
                      ? 'eventEnd.callOffFailed'
                      : thanked
                        ? 'thankYou.notEnded'
                        : 'eventEnd.failed',
                  )
                : null,
            body: thanks ? (
              <ThankYouField
                draft={draft}
                tried={tried}
                help={t('thankYou.hint')}
                optional
                autoFocus={false}
                onType={onType}
                onFocus={() => setTyping(true)}
                onBlur={() => setTyping(false)}
                testID="events.endThankYou"
              />
            ) : undefined,
            top: thanks && typing ? insets.top + tokens.spaceLg : null,
          }
        : {
            title: t('eventEnd.notEnded'),
            line: asking.kind === 'changed' ? changed : t('eventEnd.alreadyOver'),
            alert: true,
            keep: { label: t('eventLive.close'), testID: 'events.endClose' },
            confirm: null,
          })}
    />
  );
}
