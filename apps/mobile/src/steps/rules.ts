/** The client checks and shaping the demo's screens use, kept apart from React Native so they can be tested. */

export const PASSWORD_LEAST = 15;
export const CODE_LENGTH = 6;
export const MESSAGE_MOST = 500;
export const RESEND_SECONDS = 60;

export function emailLooksRight(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim());
}

export function passwordLongEnough(password: string): boolean {
  return [...password].length >= PASSWORD_LEAST;
}

/** Only digits, and no more than a code holds, whatever was pasted or offered above the keys. */
export function codeDigits(text: string): string {
  return text.replace(/\D/gu, '').slice(0, CODE_LENGTH);
}

/** A recovery code as it was saved, "vtxp-rh7y": capitals or not, and the dash put in once a fifth character comes. */
export function shapeRecovery(text: string): string {
  const plain = text
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, '')
    .slice(0, 8);

  return plain.length > 4 ? `${plain.slice(0, 4)}-${plain.slice(4)}` : plain;
}

export function recoveryComplete(code: string): boolean {
  return /^[a-z0-9]{4}-[a-z0-9]{4}$/u.test(code);
}

/** "0:54" for a wait counted in seconds. */
export function minutesSeconds(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function messageCount(message: string): string {
  return `${[...message].length} of ${MESSAGE_MOST} characters.`;
}
