import { CHOICE_OPTIONS_MINIMUM } from '@soirely/api-client';
import type { DraftReason } from '@soirely/domain';
import type { TFunction } from 'i18next';

export function choiceName(t: TFunction, choice: { question: string }, at: number): string {
  return choice.question.trim() === ''
    ? t('dishChoices.noQuestionYet', { n: at + 1 })
    : t('dishChoices.quoted', { question: choice.question });
}

export function draftWords(t: TFunction, reason: DraftReason): string {
  if (reason.kind === 'question') return t('dishChoices.noQuestion');
  if (reason.kind === 'options')
    return t('dishChoices.fewOptions', { least: CHOICE_OPTIONS_MINIMUM });

  return t('dishChoices.pickTooMany', { pick: reason.pick, options: reason.pick + 1 });
}
