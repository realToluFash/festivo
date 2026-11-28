import type { Enquiry } from './EnquiriesModel.ts';

const MADE = new Map<string, Enquiry>();

/** Held in memory for this run of the demo only, so the page a Save opens can show what was typed. */
export function keepMade(enquiry: Enquiry): void {
  MADE.set(enquiry.id, enquiry);
}

export function madeOf(id: string | undefined): Enquiry | null {
  return id == null ? null : (MADE.get(id) ?? null);
}

export function nextMadeId(): string {
  return `enq-made-${MADE.size + 1}`;
}
