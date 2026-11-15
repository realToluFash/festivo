import { Linking, Platform } from 'react-native';

import { mailApp } from '../modules/mail-app/index.ts';

// Mail's own scheme opens the inbox; `mailto:` would open a blank draft instead (sc-29071).
const IOS_MAIL = 'message://';

/** False on the iOS simulator and wherever Mail, or every email app, has been deleted. */
export async function mailAppOpens(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') return await Linking.canOpenURL(IOS_MAIL);

    return mailApp?.canOpen() ?? false;
  } catch {
    return false;
  }
}

export function openMailApp(): void {
  if (Platform.OS === 'ios') void Linking.openURL(IOS_MAIL).catch(() => {});
  else {
    try {
      mailApp?.open();
    } catch {
      // Uninstalled since the screen asked: the button stays, and Send it again is under it.
    }
  }
}
