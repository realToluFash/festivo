import type { OrganisationEvent } from '@soirely/api-client';
import { changedWords } from '@soirely/domain';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import {
  type EndRefusal,
  type PauseRefusal,
  endRefusalOf,
  pauseRefusalOf,
} from '../kit/makeLive.ts';
import { useLifecycleAction } from './LifecycleSheet.tsx';
import { Ask } from './Summary.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';

const ASK_WIDTH = 340;

type Opener = RefObject<ScreenReaderTarget | null>;
type End = 'callOff' | 'endNow';

/** Pause, Call off and End now from Manage: the question, then the reason in its place when the server refuses. */
export function useManageAsks({
  event,
  onChange,
  openers,
}: {
  event: OrganisationEvent;
  onChange: (event: OrganisationEvent) => void;
  openers: { pause: Opener; end: Opener };
}) {
  const pause = useLifecycleAction<object, PauseRefusal>({
    event,
    onChange,
    refusalOf: pauseRefusalOf,
  });
  const end = useLifecycleAction<{ label: End }, EndRefusal>({
    event,
    onChange,
    refusalOf: endRefusalOf,
  });

  return {
    askPause: () => pause.ask({}),
    askEnd: (label: End) => end.ask({ label }),
    asks: (
      <>
        <PauseAsk event={event} action={pause} opener={openers.pause} />
        <EndAsk event={event} action={end} opener={openers.end} />
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
}: {
  event: OrganisationEvent;
  action: EndAction;
  opener: Opener;
}) {
  const { t } = useTranslation();
  const changed = useChangedLine(event);
  const { asking, go, close } = action;
  const callOff = asking?.kind === 'confirm' && asking.label === 'callOff';

  return (
    <Ask
      open={asking != null}
      opener={opener}
      width={ASK_WIDTH}
      onKeep={close}
      onConfirm={() => {
        if (asking?.kind === 'confirm') go({ label: asking.label }, () => api.endEvent(event.id));
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
                ? t(callOff ? 'eventEnd.callOffFailed' : 'eventEnd.failed')
                : null,
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
