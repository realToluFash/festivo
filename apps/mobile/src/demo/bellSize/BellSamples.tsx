import { useTranslation } from 'react-i18next';

import { BellBody, type BellRowData } from '../../components/BellParts.tsx';
import type { BellRead } from './bellSizeRules.ts';

interface Sample {
  id: string;
  category: string;
  title: string;
  lines: readonly string[];
  event: string | null;
  time: string;
  unread: boolean;
}

export const SAMPLES: readonly Sample[] = [
  {
    id: 'reply',
    category: 'guest_replies',
    title: 'Ada Obi replied: coming, with 1 guest',
    lines: ['Dietary: vegetarian'],
    event: 'Adaeze & Tunde’s wedding',
    time: '09:40',
    unread: true,
  },
  {
    id: 'change',
    category: 'event_changes',
    title: 'Ana Souza changed the event',
    lines: ['Starts at 19:30, was 19:00'],
    event: 'Adaeze & Tunde’s wedding',
    time: '08:15',
    unread: true,
  },
  {
    id: 'day',
    category: 'event_day',
    title: 'Event day tomorrow',
    lines: ['Doors at 18:00. Seating is final.'],
    event: 'Lagos launch dinner',
    time: '07:30',
    unread: false,
  },
  {
    id: 'security',
    category: 'account_security',
    title: 'A new sign-in to your account',
    lines: ['iPad, Lagos'],
    event: null,
    time: '07:05',
    unread: false,
  },
];

export function unreadAt(read: BellRead): ReadonlySet<string> {
  return new Set(read === 'all' ? [] : SAMPLES.filter((one) => one.unread).map((one) => one.id));
}

/** The bell's list on the sample notifications, at the device's own size: main's BellBody, nothing sent. */
export function BellSampleBody({
  unread,
  menu,
  onMenu,
  onPick,
  onSettings,
}: {
  unread: ReadonlySet<string>;
  menu: string | null;
  onMenu: (id: string | null) => void;
  onPick: (row: BellRowData) => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  const rows: BellRowData[] = SAMPLES.map((one) => ({
    id: one.id,
    category: one.category,
    title: one.title,
    lines: one.lines,
    where:
      one.event == null
        ? t('notifications.atTime', { time: one.time })
        : t('notifications.whereWhen', {
            event: one.event,
            when: t('notifications.atTime', { time: one.time }),
          }),
    unread: unread.has(one.id),
    muted: false,
    more: null,
    goneShown: false,
    testID: `demo.bellSize.item.${one.id}`,
  }));

  return (
    <BellBody
      ask={null}
      feed="loaded"
      rows={rows}
      menu={menu}
      onMenu={onMenu}
      onPick={onPick}
      onTryAgain={() => undefined}
      more={null}
      onSettings={onSettings}
      testID="demo.bellSize.body"
    />
  );
}
