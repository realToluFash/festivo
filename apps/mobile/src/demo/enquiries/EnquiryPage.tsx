import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '../../components/Text.tsx';
import { DemoOnly } from '../../steps/Lines.tsx';
import { TaskPage } from '../settings/Frame.tsx';
import { NOW, assignedWords, changedWords, enquiryOf, whatLine } from './EnquiriesModel.ts';
import { W } from './EnquiriesWords.ts';

/** Where a result opens. The page itself is sc-31226's to draw; here it only shows that Back returns to the same search and results. */
export function EnquiryPage({ id }: { id: string | undefined }) {
  const { t } = useTranslation();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const enquiry = enquiryOf(id);
  const back = { label: W.enquiries, onPress: () => router.back() };

  if (enquiry == null)
    return (
      <TaskPage back={back} title={W.enquiries}>
        <Text size={16} weight="medium">
          This enquiry is not in the sample.
        </Text>
      </TaskPage>
    );

  return (
    <TaskPage
      back={back}
      title={enquiry.client}
      sub={whatLine(enquiry, (type) => t(`eventTypes.${type}`), W.noDate, NOW, locale)}
    >
      <Text size={16} weight="medium">
        {`${assignedWords(enquiry, W.notAssigned)} · ${changedWords(enquiry.changedAt, NOW, locale)}`}
      </Text>
      <DemoOnly title="An enquiry’s page is drawn for sc-31226. Back, or the back gesture, returns to the same search and results.">
        {null}
      </DemoOnly>
    </TaskPage>
  );
}
