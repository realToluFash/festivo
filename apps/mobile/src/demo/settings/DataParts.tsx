import { type Href, router, useLocalSearchParams } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext } from 'react';
import { StyleSheet } from 'react-native';

import { PaneWithBack } from '../../components/DataParts.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { Text } from '../../components/Text.tsx';
import { type DataPage, dataHref, type DataViewer, dataViewerOf, hubFor } from './DataModel.ts';
import { DATA_WORDS, DOMAINS_WORDS } from './DataWords.ts';
import { SummaryPage } from './SummaryPage.tsx';

export {
  DataTag,
  DataTile,
  DrawnGlyph,
  Lead,
  StatusLine,
  TagRow,
} from '../../components/DataParts.tsx';

/** Which Data and control page is open, so the Settings list lights its row. */
export const DataOpenContext = createContext<DataPage | null>(null);

export function useDataOpen(): DataPage | null {
  return useContext(DataOpenContext);
}

export const LOCK_TAG = { kind: 'lock', word: DATA_WORDS.enterprise } as const;

/** A code, a reference or an address: Sans with tabular figures, tracked 0.04em. */
export function Code({ text, size = 16 }: { text: string; size?: number }) {
  return (
    <Text
      size={size}
      weight="medium"
      selectable
      style={[styles.code, { letterSpacing: size * 0.04 }]}
    >
      {text}
    </Text>
  );
}

/** Where each Data and control page goes: one level down and back, carrying who looks and the hub's sample. */
export function useDataNav() {
  const shell = useShell();
  const params = useLocalSearchParams<{ as?: string; from?: string; state?: string }>();
  const viewer: DataViewer = dataViewerOf(params.as);
  const landscape = shell.layout === 'landscape';
  const hub = hubFor(params.state, params.from);

  const open = useCallback(
    (page: DataPage, state: string | null, from: typeof hub | null = null) => {
      const href = dataHref(page, { state, as: viewer, from }) as Href;
      // On its side the list stays put, so a page changes beside it rather than stacking.
      if (landscape) router.replace(href);
      else router.push(href);
    },
    [landscape, viewer],
  );
  const toHub = useCallback(() => {
    const href = dataHref('hub', { state: hub === 'hub' ? null : hub, as: viewer }) as Href;
    if (landscape) router.replace(href);
    else router.dismissTo(href);
  }, [landscape, hub, viewer]);

  return { viewer, open, toHub };
}

/** A page one level down: the nav's back to Data and control, and on its side the same back above the title. */
export function DataSubPage({ title, children }: { title: string; children: ReactNode }) {
  const shell = useShell();
  const { toHub } = useDataNav();
  const back = { label: DATA_WORDS.title, onPress: toHub };

  if (shell.layout !== 'landscape')
    return (
      <SummaryPage title={title} back={back}>
        {children}
      </SummaryPage>
    );

  return (
    <DataPane title={title} back={back}>
      {children}
    </DataPane>
  );
}

/** On its side, the product's pane: the back above the title, capped by it (sc-67471). */
function DataPane({
  title,
  back,
  children,
}: {
  title: string;
  back: { label: string; onPress: () => void };
  children: ReactNode;
}) {
  return (
    <SummaryPage>
      <PaneWithBack title={title} back={back}>
        {children}
      </PaneWithBack>
    </SummaryPage>
  );
}

export const DOMAIN_TAG_WORDS = [
  DOMAINS_WORDS.proved,
  DOMAINS_WORDS.waiting,
  DOMAINS_WORDS.notProved,
  DOMAINS_WORDS.missing,
];

const styles = StyleSheet.create({
  code: { fontVariant: ['tabular-nums'] },
});
