import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { AT_100, LARGEST_SCALE, SMALLEST_SCALE, ZOOMS, percentOf } from './seatingDraw.ts';

const FIT_PAD = { top: 84, right: 16, bottom: 84, left: 16 } as const;
const STEP_SLACK = 0.5;

export type Point = [number, number];

/** A view away from the fit: its scale and the room point, in cm, at the canvas's centre. */
export interface Camera {
  s: number;
  cx: number;
  cy: number;
}

interface Kept extends Camera {
  widthCm: number;
  lengthCm: number;
}

export function fitOf(width: number, height: number, room: { w: number; l: number }) {
  const w = width - FIT_PAD.left - FIT_PAD.right;
  const h = height - FIT_PAD.top - FIT_PAD.bottom;
  const s = Math.max(0.05, Math.min(w / room.w, h / room.l));

  return { s, ox: FIT_PAD.left + (w - room.w * s) / 2, oy: FIT_PAD.top + (h - room.l * s) / 2 };
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** How far the picture slides, in screen px, to show a focused box (canvas px) whole and clear of the bars floating over the room (WCAG 2.2 SC 2.4.11). Each axis is decided on its own: one where the box is larger than the view lines up with its top or left edge, and the bars are cleared along the other (sc-57361). */
export function intoView(
  box: Box,
  width: number,
  height: number,
  bars: readonly Box[] = [],
  margin = 8,
): Point {
  const left = FIT_PAD.left + margin;
  const right = width - FIT_PAD.right - margin;
  const top = FIT_PAD.top + margin;
  const bottom = height - FIT_PAD.bottom - margin;
  const slide = (from: number, to: number, lo: number, hi: number): number => {
    if (to - from > hi - lo || from < lo) return lo - from;
    if (to > hi) return hi - to;
    return 0;
  };
  const wide = box.x1 - box.x0 > right - left;
  const tall = box.y1 - box.y0 > bottom - top;
  let dx = slide(box.x0, box.x1, left, right);
  let dy = slide(box.y0, box.y1, top, bottom);

  for (const bar of bars) {
    if (wide && tall) break;
    const x0 = box.x0 + dx;
    const x1 = box.x1 + dx;
    const y0 = box.y0 + dy;
    const y1 = box.y1 + dy;

    if (x1 <= bar.x0 - margin || x0 >= bar.x1 + margin) continue;
    if (y1 <= bar.y0 - margin || y0 >= bar.y1 + margin) continue;
    const across: Point[] = [
      [bar.x0 - margin - x1, 0],
      [bar.x1 + margin - x0, 0],
    ];
    const along: Point[] = [
      [0, bar.y0 - margin - y1],
      [0, bar.y1 + margin - y0],
    ];
    const ways = wide ? along : tall ? across : [...across, ...along];
    const shortest = ways
      .filter(
        ([mx, my]) =>
          (wide || (x0 + mx >= left && x1 + mx <= right)) &&
          (tall || (y0 + my >= top && y1 + my <= bottom)),
      )
      .sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]))[0];

    if (shortest != null) {
      dx += shortest[0];
      dy += shortest[1];
    } else if (wide) {
      dy = top - box.y0;
    } else if (tall) {
      dx = left - box.x0;
    }
  }

  return [dx, dy];
}

export function clampScale(s: number): number {
  return Math.min(LARGEST_SCALE, Math.max(SMALLEST_SCALE, s));
}

function keyOf(eventId: string): string {
  return `soirely.seatingView.${eventId}`;
}

export function keptView(eventId: string, room: { w: number; l: number }): Camera | null {
  let kept: Partial<Kept> | null;

  try {
    kept = JSON.parse(
      window.localStorage.getItem(keyOf(eventId)) ?? 'null',
    ) as Partial<Kept> | null;
  } catch {
    return null;
  }
  if (
    kept == null ||
    typeof kept.s !== 'number' ||
    typeof kept.cx !== 'number' ||
    typeof kept.cy !== 'number' ||
    kept.widthCm !== room.w ||
    kept.lengthCm !== room.l
  )
    return null;

  return { s: clampScale(kept.s), cx: kept.cx, cy: kept.cy };
}

function keepView(eventId: string, room: { w: number; l: number }, camera: Camera | null): void {
  try {
    if (camera == null) window.localStorage.removeItem(keyOf(eventId));
    else
      window.localStorage.setItem(
        keyOf(eventId),
        JSON.stringify({ ...camera, widthCm: room.w, lengthCm: room.l } satisfies Kept),
      );
  } catch {
    // A browser that refuses storage opens the plan fitted next time.
  }
}

/** The plan's view (sc-4007): fitted until zoomed or moved, and kept per event on this device for as long as the room keeps its size. */
export function useCamera(
  eventId: string,
  room: { w: number; l: number } | null,
  size: { w: number; h: number },
) {
  const w = room?.w ?? 0;
  const l = room?.l ?? 0;
  const [camera, setCamera] = useState<Camera | null>(() =>
    room == null ? null : keptView(eventId, room),
  );
  const fit = fitOf(size.w, size.h, { w: w || 1, l: l || 1 });
  const s = camera?.s ?? fit.s;
  const ox = camera == null ? fit.ox : size.w / 2 - camera.cx * s;
  const oy = camera == null ? fit.oy : size.h / 2 - camera.cy * s;
  const view = useRef({ s, ox, oy, size });

  useLayoutEffect(() => {
    view.current = { s, ox, oy, size };
  });

  useEffect(() => {
    if (w > 0 && l > 0) keepView(eventId, { w, l }, camera);
  }, [eventId, w, l, camera]);

  const zoomTo = useCallback((next: number, anchor?: Point) => {
    const now = view.current;
    const [ax, ay] = anchor ?? [now.size.w / 2, now.size.h / 2];
    const clamped = clampScale(next);
    const at: Point = [(ax - now.ox) / now.s, (ay - now.oy) / now.s];

    setCamera({
      s: clamped,
      cx: at[0] - (ax - now.size.w / 2) / clamped,
      cy: at[1] - (ay - now.size.h / 2) / clamped,
    });
  }, []);

  const step = useCallback(
    (direction: 1 | -1) => {
      const pct = percentOf(view.current.s);
      const next =
        direction > 0
          ? ZOOMS.find((one) => one > pct + STEP_SLACK)
          : [...ZOOMS].reverse().find((one) => one < pct - STEP_SLACK);

      if (next != null) zoomTo((next / 100) * AT_100);
    },
    [zoomTo],
  );

  const panBy = useCallback((dx: number, dy: number) => {
    const now = view.current;

    setCamera({
      s: now.s,
      cx: (now.size.w / 2 - now.ox + dx) / now.s,
      cy: (now.size.h / 2 - now.oy + dy) / now.s,
    });
  }, []);

  return {
    s,
    ox,
    oy,
    view,
    zoomTo,
    step,
    panBy,
    fitRoom: () => setCamera(null),
    atSmallest: s <= SMALLEST_SCALE + 1e-9,
    atLargest: s >= LARGEST_SCALE - 1e-9,
  };
}
