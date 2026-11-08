import { requireOptionalNativeModule } from 'expo';

interface MailApp {
  canOpen(): boolean;
  open(): void;
}

/** Android only, and absent from a build made before it was added. */
export const mailApp = requireOptionalNativeModule<MailApp>('MailApp');
