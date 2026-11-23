/** A row in a page's scroll, with the toast held over the page's foot, all in the window's frame but `contentY` and `content`. */
export interface RowOverToast {
  contentY: number;
  height: number;
  offset: number;
  scrollTop: number;
  scrollHeight: number;
  toastTop: number;
  /** The content's height without any room the page's foot was given for the toast. */
  content: number;
  margin: number;
}

/** Where the scroll goes, null to stay, and the room the page's foot needs for it to get there. */
export interface ToastRest {
  to: number | null;
  room: number;
}

/** Where a row a screen reader's focus goes back to rests: wholly in sight, `margin` above the toast's top; a row taller than the room above the toast rests `margin` under the scroll's top (sc-86228). */
export function restAboveToast(at: RowOverToast): ToastRest {
  const { contentY, height, offset, scrollTop, scrollHeight, toastTop, content, margin } = at;
  const end = Math.max(0, content - scrollHeight);
  const limit = Math.min(toastTop - margin, scrollTop + scrollHeight);
  const room = limit - scrollTop;
  const top = scrollTop + contentY - offset;
  const fits = height <= room;

  if (fits && top >= scrollTop && top + height <= limit)
    return { to: null, room: Math.max(0, offset - end) };

  const to = Math.max(
    0,
    !fits
      ? contentY - margin
      : top < scrollTop
        ? Math.max(contentY + height - room, contentY - margin)
        : contentY + height - room,
  );

  return { to, room: Math.max(0, to - end) };
}
