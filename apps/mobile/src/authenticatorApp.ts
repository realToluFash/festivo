import { Linking } from 'react-native';

/** False where no app on the device takes otpauth:// links, and wherever the question cannot be asked. */
export async function authenticatorTakes(link: string): Promise<boolean> {
  try {
    return await Linking.canOpenURL(link);
  } catch {
    return false;
  }
}

/** Hands the link to the app that takes it, and to nothing else: no copy, no share sheet. */
export function openInAuthenticator(link: string): void {
  void Linking.openURL(link).catch(() => {});
}
