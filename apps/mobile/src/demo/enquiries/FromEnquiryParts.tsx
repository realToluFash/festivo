import { type Href, router } from 'expo-router';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { type ScrollViewInstance, StyleSheet, View, type ViewInstance } from 'react-native';

import { Choices } from '../../components/EventEdits.tsx';
import { EventNotice } from '../../components/EventNotice.tsx';
import { Legend, SheetBody, SheetLayer } from '../../components/FormLayers.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { type Layer, TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { W as EW } from '../events/EventsWords.ts';
import { W } from './EnquiryEventWords.ts';
import {
  EVENT_ENQUIRIES,
  type FromEnquiry,
  type Lead,
  MEMBERS,
  ORIGIN_HREF,
} from './EnquiryToEventModel.ts';

export interface EnquiryParts {
  notice: ReactNode;
  lead: ReactNode;
  over: Layer | null;
  currencyHelp: string | null;
  notCreated: string | null;
  refuses: boolean;
  leaves: boolean;
  opens: Readonly<Record<string, string>> | null;
}

/** What New event adds when it is filled from an enquiry (sc-31232); nothing at all without one. */
export function useFromEnquiry(
  from: FromEnquiry | undefined,
  {
    busy,
    currency,
    scroll,
  }: { busy: boolean; currency: string; scroll: RefObject<ScrollViewInstance | null> },
): EnquiryParts {
  const [lead, setLead] = useState<Lead | null>(from?.lead ?? null);
  const [picking, setPicking] = useState(false);
  const [focusing, setFocusing] = useState(0);
  const who = useRef<ViewInstance>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    if (focusing === 0) return undefined;
    const later = setTimeout(() => moveScreenReaderFocus(who.current), SETTLED_MS);

    return () => clearTimeout(later);
  }, [focusing]);

  if (from == null)
    return {
      notice: null,
      lead: null,
      over: null,
      currencyHelp: null,
      notCreated: null,
      refuses: false,
      leaves: false,
      opens: null,
    };

  const settle = (next: Lead) => {
    setLead(next);
    setFocusing((count) => count + 1);
  };
  const close = () => setPicking(false);
  const pick = () => !busy && setPicking(true);

  return {
    notice: <EventNotice tone="quiet" words={W.filled(from.client)} />,
    lead: lead != null && (
      <View
        style={styles.part}
        onLayout={(event) => {
          if (!from.leadInView || scrolled.current) return;
          scrolled.current = true;
          scroll.current?.scrollTo({
            y: Math.max(0, event.nativeEvent.layout.y - tokens.spaceXl),
            animated: false,
          });
        }}
      >
        <Legend text={W.lead} />
        <View style={styles.lines}>
          <View ref={who} accessible accessibilityLabel={W.leadLabel(lead.name ?? W.noLead)}>
            <Text size={16} weight="semibold" accessible={false}>
              {lead.name ?? W.noLead}
            </Text>
          </View>
          <Text size={14.5} weight="medium" style={styles.secondary}>
            {lead.name == null ? W.notGiven(lead.was) : W.leadLine}
          </Text>
        </View>
        <View style={styles.actions}>
          {lead.name == null ? (
            <TextAction
              label={W.chooseLead}
              off={busy}
              onPress={pick}
              testID="enquiryEvent.lead.choose"
            />
          ) : (
            <>
              <TextAction
                label={W.change}
                off={busy}
                onPress={pick}
                testID="enquiryEvent.lead.change"
              />
              <TextAction
                label={W.remove}
                off={busy}
                onPress={() => settle({ name: null, was: lead.was })}
                testID="enquiryEvent.lead.remove"
              />
            </>
          )}
        </View>
      </View>
    ),
    over:
      picking && lead != null
        ? {
            layer: (
              <SheetLayer onClose={close} label={EW.cancel}>
                <SheetBody
                  title={W.chooseLead}
                  close={EW.cancel}
                  onClose={close}
                  closeTestID="enquiryEvent.lead.close"
                >
                  <Choices
                    items={MEMBERS.map((name) => ({ key: name, title: name }))}
                    on={lead.name}
                    onPick={(name) => {
                      close();
                      settle({ name, was: name });
                    }}
                    testID="enquiryEvent.lead.member"
                  />
                </SheetBody>
              </SheetLayer>
            ),
            onClose: close,
          }
        : null,
    currencyHelp:
      from.currencyFrom === 'budget' && currency === from.typed.currency ? W.fromBudget : null,
    notCreated: from.refusal === 'forbidden' ? W.forbidden : null,
    refuses: from.refusal === 'forbidden',
    leaves: from.refusal === 'notOpen',
    opens: OPENS,
  };
}

const OPENS = { state: 'from-enquiry' } as const;

/** The draft's Details, last: the enquiry it was made from, for whoever can open that enquiry. */
export function FromEnquiryLine() {
  return (
    <TextAction
      label={W.fromEnquiry(EVENT_ENQUIRIES.bisi.client)}
      glyph="link"
      wraps
      onPress={() => router.push(ORIGIN_HREF as Href)}
      testID="enquiryEvent.origin"
    />
  );
}

const styles = StyleSheet.create({
  part: { gap: tokens.spaceLg },
  lines: { gap: tokens.spaceXxs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceXl },
  secondary: { color: tokens.colorInkSecondary, lineHeight: 14.5 * 1.4 },
});
