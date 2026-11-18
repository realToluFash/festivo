/** A member's own account name up to its first space. Never a guest's: guests go through guestName.ts. */
export function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}
