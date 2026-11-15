import { Bell, type Tell } from '../components/SettingsParts.tsx';

export function DemoBell({ tell }: { tell: Tell }) {
  return <Bell unread={3} onOpen={() => tell('Notifications have their own design.')} />;
}
