import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type CalendarPlace,
  type CalendarView,
  calendarPlaceKey,
  keptCalendarPlace,
  readCalendarPlace,
} from '@soirely/domain';

import { landingOf } from './calendar.ts';

export interface Opening {
  view: CalendarView;
  at: string;
}

/** Where the Calendar opens for a person: the view and month they last kept on this device, or Month at today's month. */
export async function openingOf(personId: string, today: string): Promise<Opening> {
  const place = await AsyncStorage.getItem(calendarPlaceKey(personId)).then(
    readCalendarPlace,
    () => null,
  );

  return {
    view: place?.view ?? 'month',
    at: place == null ? today : landingOf(place.month, today),
  };
}

export async function keepPlace(personId: string, place: CalendarPlace): Promise<void> {
  await AsyncStorage.setItem(calendarPlaceKey(personId), keptCalendarPlace(place)).catch(
    () => undefined,
  );
}
