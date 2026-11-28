/** The tallest height reported at one text size, width and language; a report under another `at` starts again from it alone. */
export interface Tallest {
  at: string;
  height: number;
}

export function reportHeight(now: Tallest, at: string, height: number): Tallest {
  if (now.at !== at) return { at, height };

  return height > now.height ? { at, height } : now;
}

export function tallestAt(now: Tallest, at: string): number | undefined {
  return now.at === at && now.height > 0 ? now.height : undefined;
}
