import { type Href, router } from 'expo-router';
import type { ComponentProps } from 'react';

import { NavBar as ProductNavBar } from '../components/DemoScreen.tsx';

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

/** The product's bar, its ‹ and ✕ leading back through the demo unless a screen says otherwise. */
export function NavBar(props: ComponentProps<typeof ProductNavBar>) {
  const { left = 'back', onLeft } = props;

  return (
    <ProductNavBar {...props} onLeft={onLeft ?? (left === 'close' ? () => closeFlow() : goBack)} />
  );
}
