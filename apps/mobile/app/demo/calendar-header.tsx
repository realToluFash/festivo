import { useLocalSearchParams } from 'expo-router';

import { CalendarShell } from '../../src/demo/calendar/Route.tsx';
import { CalendarHeaderScreen } from '../../src/demo/calendarHeader/CalendarHeaderScreen.tsx';
import {
  HEADER_LANGUAGES,
  HEADER_REFRESHING,
} from '../../src/demo/calendarHeader/calendarHeaderRules.ts';
import { FILTER_SIZES, keyOf } from '../../src/demo/filterSize/filterSizeRules.ts';

export default function DemoCalendarHeader() {
  const { size, lang, refreshing } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    refreshing?: string;
  }>();
  const start = {
    size: keyOf(FILTER_SIZES, size, 'device'),
    language: keyOf(HEADER_LANGUAGES, lang, 'en'),
    refreshing: keyOf(HEADER_REFRESHING, refreshing, 'off'),
  };

  return (
    <CalendarShell>
      <CalendarHeaderScreen key={JSON.stringify(start)} start={start} />
    </CalendarShell>
  );
}
