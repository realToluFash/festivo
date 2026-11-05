import { contactActions, contactsLeft } from '@soirely/domain';
import type { Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { tokens } from '../../theme/tokens.ts';
import { LEAD_INSET, LineIcon } from './AccountCard.tsx';
import {
  type ContactKind,
  contactLine,
  contactsFoot,
  KIND_WORDS,
  primaryFirst,
  WORDS,
} from './AccountModel.ts';
import type { Contact } from './AccountSample.ts';
import { Line, OpenRow, Row, RowList, Section, TextAction } from './Summary.tsx';

const UNVERIFIED = { kind: 'notyet', word: 'Unverified' } as const;

interface OfferRefs {
  sendRef: Ref<ViewInstance>;
  promoteRef: Ref<ViewInstance>;
  removeRef: Ref<ViewInstance>;
}

/** Email addresses or phone numbers: one row each, the primary first; any other opens in place with what it offers. */
export function ContactsSection({
  kind,
  rows,
  opened,
  addRef,
  sendRef,
  promoteRef,
  removeRef,
  onAdd,
  onBlock,
  onToggle,
  onVerify,
  onMakePrimary,
  onRemove,
}: {
  kind: ContactKind;
  rows: readonly Contact[];
  opened: string | null;
  addRef: Ref<ViewInstance>;
  onAdd: () => void;
  onBlock: (id: string, block: ViewInstance | null) => void;
  onToggle: (id: string) => void;
  onVerify: (row: Contact) => void;
  onMakePrimary: (row: Contact) => void;
  onRemove: (row: Contact) => void;
} & OfferRefs) {
  const words = KIND_WORDS[kind];
  const lead = <LineIcon name={kind === 'email' ? 'mail' : 'phone'} />;

  return (
    <Section
      title={words.section}
      right={
        contactsLeft(rows) > 0 ? (
          <TextAction
            ref={addRef}
            label={words.addTitle}
            onPress={onAdd}
            testID={`account.${kind}.add`}
          />
        ) : null
      }
      foot={contactsFoot(kind, rows)}
    >
      <RowList
        items={primaryFirst(rows).map((row) => {
          const line = contactLine(kind, row);
          const tag = row.verified ? null : UNVERIFIED;
          const label = [row.shown, tag?.word, line].filter(Boolean).join('. ');
          const open = opened === row.id;

          return {
            key: row.id,
            inset: LEAD_INSET,
            selected: open,
            row: row.primary ? (
              <Row
                title={row.shown}
                line={line}
                lead={lead}
                tag={tag}
                accessibilityLabel={label}
                testID={`account.${row.id}`}
              />
            ) : (
              <View ref={(block) => onBlock(row.id, block)} collapsable={false}>
                <OpenRow
                  title={row.shown}
                  line={line}
                  lead={lead}
                  tag={tag}
                  weight="semibold"
                  lit
                  open={open}
                  onToggle={() => onToggle(row.id)}
                  accessibilityLabel={label}
                  testID={`account.${row.id}`}
                >
                  <Offers
                    row={row}
                    sendRef={sendRef}
                    promoteRef={promoteRef}
                    removeRef={removeRef}
                    onVerify={onVerify}
                    onMakePrimary={onMakePrimary}
                    onRemove={onRemove}
                  />
                </OpenRow>
              </View>
            ),
          };
        })}
      />
    </Section>
  );
}

function Offers({
  row,
  sendRef,
  promoteRef,
  removeRef,
  onVerify,
  onMakePrimary,
  onRemove,
}: {
  row: Contact;
  onVerify: (row: Contact) => void;
  onMakePrimary: (row: Contact) => void;
  onRemove: (row: Contact) => void;
} & OfferRefs) {
  const offers = contactActions(row);

  return (
    <>
      <View style={styles.actions}>
        {offers.verify && (
          <TextAction
            ref={sendRef}
            label={WORDS.sendCode}
            onPress={() => onVerify(row)}
            testID={`account.${row.id}.send`}
          />
        )}
        {offers.makePrimary && (
          <TextAction
            ref={promoteRef}
            label={WORDS.makePrimary}
            onPress={() => onMakePrimary(row)}
            testID={`account.${row.id}.primary`}
          />
        )}
        {offers.remove && (
          <TextAction
            ref={removeRef}
            label={offers.askBeforeRemoving ? WORDS.removeAsking : WORDS.remove}
            removes
            onPress={() => onRemove(row)}
            accessibilityLabel={WORDS.remove}
            testID={`account.${row.id}.remove`}
          />
        )}
      </View>
      <Line size={14} text={WORDS.removeLine} />
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space3xl },
});
