import { type RefObject, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  PersonFace,
  type Removing,
  RoleSheet as PersonSheet,
} from '../../components/PeopleParts.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Line } from '../../components/Summary.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  type EventRole,
  HELD_MS,
  joinedWithLine,
  leadOff,
  type OnEvent,
  ORGANISATION,
  OUTSIDE_ENDS,
  rolesOff,
  SAVE_MS,
  sheetLine,
  sheetWords,
} from './PeopleSample.ts';

export function Face({ person, side }: { person: OnEvent; side: number }) {
  return <PersonFace initials={person.initials} tone={person.tone} side={side} />;
}

function later(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/** The product's sheet on sample data: nothing is sent, a timer stands in for each request and roleFails for its failing. */
export function RoleSheet({
  person,
  open,
  roleFails,
  opener,
  organisation = ORGANISATION,
  removingAtStart = null,
  locale = 'en',
  today,
  onSaved,
  onClose,
  onRemove,
}: {
  person: OnEvent;
  open: boolean;
  roleFails: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  organisation?: string;
  removingAtStart?: Removing;
  locale?: string;
  today?: string | undefined;
  onSaved: (role: EventRole) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const holds = useRef(removingAtStart === 'sending');

  return (
    <PersonSheet
      person={{
        name: person.name,
        line: sheetLine(person, organisation),
        face: <Face person={person} side={44} />,
      }}
      notes={
        person.outside && (
          <View style={styles.outside}>
            {person.byCode != null && (
              <Line text={joinedWithLine(person.byCode, locale, today)} size={14} />
            )}
            <Line text={OUTSIDE_ENDS} size={14} />
          </View>
        )
      }
      start={person.role}
      off={{ roles: rolesOff(person), line: leadOff(organisation) }}
      words={sheetWords(person)}
      open={open}
      opener={opener}
      removingAtStart={removingAtStart}
      save={async (role) => {
        await later(SAVE_MS);
        if (roleFails) throw new Error('The demo’s role change fails.');
        onSaved(role);

        return role;
      }}
      remove={() => {
        const ms = holds.current ? HELD_MS : SAVE_MS;
        holds.current = false;

        return later(ms);
      }}
      onClose={onClose}
      onRemoved={onRemove}
    />
  );
}

const styles = StyleSheet.create({
  outside: { gap: tokens.spaceHair },
});
