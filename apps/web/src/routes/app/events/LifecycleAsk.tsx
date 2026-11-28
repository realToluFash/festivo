import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ManageItem } from '../../../components/EventPageParts.tsx';
import { Ask } from '../../../components/SettingsParts.tsx';
import { type Asking } from './useLifecycleAction.ts';

/** The question Pause, Call off and End now ask in the demo's dialog, and the refusal it turns into (sc-48603). */
export function LifecycleAsk<C>({
  asking,
  title,
  line,
  failed,
  keep,
  confirm,
  sending,
  red = true,
  children,
  onGo,
  onClose,
}: {
  asking: Asking<C>;
  title: string;
  line: string;
  failed: string;
  keep: string;
  confirm: string;
  sending: string;
  red?: boolean;
  /** Under the line while it asks, as End now's thank-you (sc-6476). */
  children?: ReactNode;
  onGo: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  if (asking.kind === 'refused')
    return (
      <Ask
        title={asking.title}
        line={asking.line}
        keep={t('eventLive.close')}
        titleFirst
        onKeep={onClose}
      />
    );

  return (
    <Ask
      title={title}
      line={line}
      keep={keep}
      go={confirm}
      red={red}
      busy={asking.pending ? sending : undefined}
      failed={asking.failed ? failed : undefined}
      onKeep={onClose}
      onGo={onGo}
    >
      {children}
    </Ask>
  );
}

type Look = { className: string; describedBy: string } | null;

/** In Manage on the event's page the opener is an item over what it does, and its dialog an item of its own, so it outlives an opener the reloaded event no longer offers. */
export function InManage({
  on,
  line,
  red = false,
  children,
}: {
  on: boolean;
  line?: string;
  red?: boolean;
  children: ReactNode | ((look: Look) => ReactNode);
}) {
  if (typeof children !== 'function') return on ? <li>{children}</li> : children;
  if (!on || line == null) return children(null);

  return (
    <ManageItem line={line} red={red}>
      {children}
    </ManageItem>
  );
}
