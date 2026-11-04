import { type Href, router } from 'expo-router';
import type { ComponentProps } from 'react';

import { NavBar as StepsNavBar } from '../steps/StepScreen.tsx';

export {
  InSheet,
  StepBar,
  StepScreen as DemoScreen,
  useInSheet,
  useStepsInSheet,
} from '../steps/StepScreen.tsx';

export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/demo');
}

export function closeFlow(to: Href = '/demo'): void {
  router.dismissTo(to);
}

export function finish(toast?: string): void {
  router.replace(toast == null ? '/demo/home' : { pathname: '/demo/home', params: { toast } });
}

/** The steps' bar, with Back and Close leaving within the demo. */
export function NavBar(
  props: Omit<ComponentProps<typeof StepsNavBar>, 'onLeft' | 'testID'> & {
    onLeft?: () => void;
  },
) {
  const left = props.left ?? 'back';

  return (
    <StepsNavBar
      {...props}
      onLeft={props.onLeft ?? (left === 'back' ? goBack : () => closeFlow())}
      testID="demo"
    />
  );
}
