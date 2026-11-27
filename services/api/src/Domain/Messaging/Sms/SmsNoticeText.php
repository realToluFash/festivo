<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Sms;

use App\Domain\Messaging\Sms\Model\SmsFrom;
use LogicException;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The notice as a text (sc-3946): the hosts named first, filled-in punctuation plain, and on a number's first text from the organisation the line that says how to stop. */
final readonly class SmsNoticeText
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** @param ?string $stopLink the guest's link to stop this organisation's texts, used where the sender can't take a reply */
    public function of(string $hosts, string $event, string $link, string $locale, SmsFrom $from, bool $first, ?string $stopLink): string
    {
        $text = $this->translator->trans('sms.notice', ['hosts' => PlainPunctuation::of($hosts), 'event' => PlainPunctuation::of($event), 'link' => $link], 'messages', $locale);

        if (!$first) {
            return $text;
        }

        // A line of its own, so no phone's link detection runs the next word into the link above it.
        return $text . "\n" . ($from->takesReplies
            ? $this->translator->trans('sms.reply_to_stop', [], 'messages', $locale)
            : $this->translator->trans('sms.stop_link', ['link' => $stopLink ?? throw new LogicException('A sender that takes no reply needs the stop link.')], 'messages', $locale));
    }
}
