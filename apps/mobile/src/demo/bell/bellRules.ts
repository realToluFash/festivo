export type BellAt = 'top' | 'scrolled';

export interface BellStart {
  ask: boolean;
  at: BellAt;
}

export function bellStartOf(ask: string | undefined, at: string | undefined): BellStart {
  return { ask: ask === 'shown', at: at === 'scrolled' ? 'scrolled' : 'top' };
}

/** On its side a phone's top scrolls away with the list, as Events' does (sc-39471); upright it stays above the list, as on main. */
export function topScrolls(window: { width: number; height: number }): boolean {
  return window.width > window.height;
}

/** How far up from the screen's foot the fade under the phone's tab bar reaches, as `TabBarFade` draws it. */
export const FADE_REACH = 150;

export interface ListRoom {
  /** From the foot of what stays above the list to the top of the tab bar, as the AC measures it. */
  list: number;
  /** Half the screen's height, the least the list may have on its side. */
  least: number;
  /** The part of the list above the fade, where a notification can be stopped whole. */
  clear: number;
}

export function listRoom(height: number, fixedAbove: number, tabBarClearance: number): ListRoom {
  return {
    list: height - fixedAbove - tabBarClearance,
    least: Math.ceil(height / 2),
    clear: height - fixedAbove - FADE_REACH,
  };
}
