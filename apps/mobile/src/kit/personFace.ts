/** The same person always has the same colour, wherever their face is drawn: keyed on the user's id, never a membership's. */
export function toneOf(userId: string): number {
  return [...userId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
