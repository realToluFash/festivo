import { ApiError, type StaffReminder } from '@soirely/api-client';

export type FlipResult =
  | { kind: 'saved'; card: StaffReminder }
  | { kind: 'failed'; card: StaffReminder }
  | { kind: 'over'; card: StaffReminder };

export async function flipReminder(
  card: StaffReminder,
  next: boolean,
  save: (on: boolean) => Promise<StaffReminder>,
): Promise<FlipResult> {
  try {
    return { kind: 'saved', card: await save(next) };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'event_concluded')
      return { kind: 'over', card };

    return { kind: 'failed', card };
  }
}
