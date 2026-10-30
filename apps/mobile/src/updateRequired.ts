/** A build below its platform's minimum is asked to update (sc-22620). Fails open: anything unreadable is never below. */
import { useSyncExternalStore } from 'react';
import type { AppStateStatus } from 'react-native';

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export const ANSWER_WINDOW_MS = 2000;

function parts(version: string): [number, number, number] | null {
  const match = VERSION.exec(version);
  if (match == null) return null;

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** SemVer 2.0.0 §11 on major.minor.patch. `null` is a minimum that is not a version: a failed check, not "no minimum". */
export function isBelow(build: string | null | undefined, minimum: string | null): boolean | null {
  if (minimum == null) return false;

  const theirs = parts(minimum);
  if (theirs == null) return null;

  const ours = build == null ? null : parts(build);
  if (ours == null) return false;

  for (let i = 0; i < 3; i += 1) {
    if (ours[i] !== theirs[i]) return ours[i]! < theirs[i]!;
  }

  return false;
}

export function storeUrl(platform: 'ios' | 'android', appStoreId: string | undefined): string {
  if (platform === 'android')
    return 'https://play.google.com/store/apps/details?id=com.soirely.app';

  return appStoreId == null
    ? 'https://apps.apple.com/search?term=Soirely'
    : `https://apps.apple.com/app/id${appStoreId}`;
}

/** A late below-minimum answer is kept, and shows at the next `opened`; `answered(null)` is a failed check. */
export interface UpdateGate {
  opened(at: number): void;
  answered(below: boolean | null, check: number, at: number): void;
  readonly check: number;
  readonly showing: boolean;
}

export function createUpdateGate(onChange: (showing: boolean) => void): UpdateGate {
  let check = 0;
  let openedAt = 0;
  let kept = false;
  let showing = false;

  function show(next: boolean): void {
    if (next === showing) return;
    showing = next;
    onChange(next);
  }

  return {
    get check() {
      return check;
    },
    get showing() {
      return showing;
    },
    opened(at) {
      check += 1;
      openedAt = at;
      if (kept) show(true);
    },
    answered(below, answeredCheck, at) {
      if (below == null) return;

      const current = answeredCheck === check;

      if (!below) {
        if (!current) return;
        kept = false;
        show(false);
        return;
      }

      kept = true;
      if (current && at - openedAt <= ANSWER_WINDOW_MS) show(true);
    },
  };
}

/** RN reports iOS's WillEnterForeground as `background`, so a return is `background → active`; Control Center's `inactive → active` is not one. */
export function cameToForeground(last: string | null | undefined, next: AppStateStatus): boolean {
  return last === 'background' && next === 'active';
}

let required = false;
const listeners = new Set<() => void>();

export function setUpdateRequired(next: boolean): void {
  if (next === required) return;
  required = next;
  listeners.forEach((listener) => listener());
}

/** Each React Native Modal is a native window above the root, where the state is, so while it shows every one gives way. */
export function useModalOpen(open: boolean): boolean {
  const gated = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => required,
  );

  return open && !gated;
}
