import { Welcome } from '../src/components/Welcome.tsx';
import { DevTools } from './index.tsx';

/** Welcome with the reason somebody is back on it: signed out, by a rule, or Google or Apple not working. */
export default function WelcomeAgain() {
  return <Welcome devTools={<DevTools />} />;
}
