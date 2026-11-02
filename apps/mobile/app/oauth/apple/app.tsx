import { Redirect } from 'expo-router';

/** The App Link opened the app outside a sign-in, so there is no attempt to finish: start again. */
export default function AppleAppLink() {
  return <Redirect href="/sign-in" />;
}
