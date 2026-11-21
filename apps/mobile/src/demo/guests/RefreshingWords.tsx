import { Refreshing } from '../../components/Refreshing.tsx';

/** The product's Refreshing… with its words handed in, so the demo can speak Portuguese, wrapping as Guests' own line does (sc-71821). */
export function RefreshingWords({ words, testID }: { words: string; testID: string }) {
  return <Refreshing words={words} testID={testID} wraps />;
}
