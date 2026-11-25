import type { LayoutKind } from '../../layout/classify.ts';
import { atAccessibilitySizes, fitWidest, labelStart, piecesIn } from '../../layout/textSize.ts';

export type TodayName = 'qa' | 'long';
export type TodayGreeting = 'morning' | 'evening' | 'welcome';

export const TODAY_NAMES: readonly { key: TodayName; label: string }[] = [
  { key: 'qa', label: 'QA' },
  { key: 'long', label: 'Maximiliano-Bartholomew' },
];

export const TODAY_GREETINGS: readonly { key: TodayGreeting; label: string }[] = [
  { key: 'morning', label: 'Morning' },
  { key: 'evening', label: 'Evening' },
  { key: 'welcome', label: 'First run' },
];

export const HEAD = 22;
export const HEAD_LINK = 14.5;
export const NEXT_UP = 12;

/** Main's sizes on the cover: the phone's foot, the iPad's foot upright, the banner on its side. */
export function greetingSize(kind: LayoutKind): number {
  return kind === 'phone' ? 32 : kind === 'tabletPortrait' ? 46 : 38;
}

export function subSize(kind: LayoutKind): number {
  return kind === 'phone' ? 16 : kind === 'tabletPortrait' ? 19 : 17;
}

export function greetingMost(kind: LayoutKind): number | undefined {
  return kind === 'tabletPortrait' ? 620 : kind === 'tabletLandscape' ? 520 : undefined;
}

export function wordsStart(size: number, scale: number, cap: number): number {
  return atAccessibilitySizes(scale) ? labelStart(size, scale, cap) : size * scale;
}

/** Below AX1 main's size; from AX1 the largest at which the widest piece fits `room`, never under `size` (sc-69816). */
export function wordsSize(
  size: number,
  scale: number,
  cap: number,
  widest: number,
  room: number,
): number {
  const start = wordsStart(size, scale, cap);

  return atAccessibilitySizes(scale) ? fitWidest(size, start, widest, room) : start;
}

/** A comma stays on its word, so no line starts with one (UAX #14, LB13); a name splits only after its own hyphen. */
export function piecesOfLine(text: string): string[] {
  return piecesIn([text]);
}

export function linkUnder(scale: number): boolean {
  return atAccessibilitySizes(scale);
}

export function greetingName(name: TodayName): string {
  return TODAY_NAMES.find((one) => one.key === name)?.label ?? 'QA';
}
