<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Sms;

use App\Domain\Messaging\GuestMessages\GuestSuppressions;
use App\Domain\Messaging\Sms\Model\SmsKeyword;
use App\Enum\SmsKeywordAction;
use App\Locale\GuestLanguage;
use App\Repository\GuestRepository;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\Translation\TranslatorInterface;

/** What a text to Soirely's number does and what it is answered with (sc-3946). The replies name Soirely, never an organisation, since the number is every organisation's. */
final readonly class SmsKeywordAnswerer
{
    public function __construct(
        private GuestSuppressions $guestSuppressions,
        private GuestRepository $guestRepository,
        private TranslatorInterface $translator,
        #[Autowire(env: 'SUPPORT_EMAIL')]
        private string $supportAddress,
    ) {
    }

    /** @return ?string the one reply to send, or null for a text that holds no keyword */
    public function answer(string $from, string $body): ?string
    {
        $keyword = SmsKeywordReader::read($body);

        if (null === $keyword) {
            return null;
        }

        match ($keyword->action) {
            SmsKeywordAction::Stop => $this->guestSuppressions->stopTextsEverywhere($from),
            SmsKeywordAction::Start => $this->guestSuppressions->resumeTextsEverywhere($from),
            SmsKeywordAction::Help => null,
        };

        return $this->translator->trans('sms.reply.' . $keyword->action->value, ['supportAddress' => $this->supportAddress], 'messages', $this->language($from, $keyword));
    }

    /** The keyword's own language where the word says one, else the guest's, else their event's. */
    private function language(string $from, SmsKeyword $keyword): string
    {
        if (null !== $keyword->language) {
            return $keyword->language;
        }

        $guest = $this->guestRepository->findLatestByMobile($from);

        return null === $guest ? 'en' : GuestLanguage::forMessage($guest);
    }
}
