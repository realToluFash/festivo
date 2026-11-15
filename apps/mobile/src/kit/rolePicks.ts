/** What the sheet shows once a save answers; `null` when a later pick still owns the sheet. */
export type PickAnswer<R> =
  { kind: 'saved'; role: R } | { kind: 'overtaken'; role: R } | { kind: 'failed'; held: R } | null;

/** A role saves as it is picked; only the latest pick speaks, and a failure goes back to the role the API last held. */
export class RolePicks<R> {
  private held: R;
  private sent = 0;
  private settled = true;

  constructor(start: R) {
    this.held = start;
  }

  pick(): number {
    this.sent += 1;
    this.settled = false;

    return this.sent;
  }

  saved(sent: number, role: R): PickAnswer<R> {
    this.held = role;
    if (sent === this.sent) {
      this.settled = true;

      return { kind: 'saved', role };
    }

    return this.settled ? { kind: 'overtaken', role } : null;
  }

  refused(sent: number): PickAnswer<R> {
    if (sent !== this.sent) return null;
    this.settled = true;

    return { kind: 'failed', held: this.held };
  }
}
