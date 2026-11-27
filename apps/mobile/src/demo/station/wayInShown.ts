import { type InsideLevel } from '../doorCode/RedeemModel.ts';
import { type FloorState } from '../floor/FloorModel.ts';
import { type OnFloor, floorLine } from '../floor/floorWayIn.ts';
import { type MyNightState } from '../myNight/myNightModel.ts';

/** A service row on Overview: Kitchen station (sc-95382) or Floor (sc-98893). */
export interface ServiceLink {
  line: string;
  href: string;
  /** The read has not answered yet: no row until it does, then it fades in. */
  answersIn?: number;
  /** The line after a move or the next read that succeeds, and when it lands. */
  moves?: { line: string; in: number };
}

interface Shown {
  who: string;
  rostered: boolean;
  night: MyNightState;
  now: Date;
  station: ServiceLink | null;
  floor: ServiceLink | null;
}

/** The one Overview both /demo/kitchen-way-in and /demo/floor-way-in draw. */
export type WayInOverview =
  | (Shown & { page: 'rows'; role: InsideLevel })
  | (Shown & { page: 'organiser'; role: InsideLevel | 'Lead' | 'Admin' });

/** The organiser's Overview draws the Events sample's own wedding, in London. */
export const ORGANISER_EVENT = 'evt-wed-4';

export const READ_ANSWERS_IN = 1500;

export interface OnFloorAt {
  on: OnFloor;
  /** The Floor demo's state the row opens. */
  opens: FloorState;
}

export function floorLinkOf(at: OnFloorAt, locale: string): ServiceLink {
  return {
    line: floorLine(at.on, locale),
    href: `/demo/floor?state=${at.opens}&from=overview`,
  };
}
