import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type CalendarPlace,
  type CalendarView,
  keptCalendarPlace,
  readCalendarPlace,
} from '@soirely/domain';

import { landingOf } from './calendar.ts';

export interface Opening {
  view: CalendarView;
  at: string;
}

/** Where the Calendar opens under a key: the view and month kept there, or Month at today's month. */
export async function openingOf(kept: string, today: string): Promise<Opening> {
  const place = await AsyncStorage.getItem(kept).then(readCalendarPlace, () => null);

  return {
    view: place?.view ?? 'month',
    at: place == null ? today : landingOf(place.month, today),
  };
}

export async function keepPlace(kept: string, place: CalendarPlace): Promise<void> {
  await AsyncStorage.setItem(kept, keptCalendarPlace(place)).catch(() => undefined);
}
