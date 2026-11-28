import { requireOptionalNativeModule } from 'expo';

export interface PickedNumber {
  number: string;
  label: string;
  mobile: boolean;
}

/** Only what Soirely may keep of a contact, and the numbers to choose one from (sc-7579). */
export interface PickedContact {
  name: string;
  numbers: PickedNumber[];
  email: string | null;
}

interface ContactPicker {
  /** iOS: the system picker, many at once, with no Contacts permission. Cancelled, none. */
  pickMany(): Promise<PickedContact[]>;
  /** Android: whether the Contacts permission was ever asked for, so a refusal is never asked again. */
  asked(): boolean;
  allowed(): boolean;
  ask(): Promise<boolean>;
  /** Android, once allowed: every contact, by name. */
  list(): Promise<PickedContact[]>;
  /** Android without the permission: the system's one-person picker, which hands over the number picked. */
  pickOne(): Promise<PickedContact | null>;
}

/** Absent from a build made before it was added. */
export const contactPicker = requireOptionalNativeModule<ContactPicker>('ContactPicker');
