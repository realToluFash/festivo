<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Domain\User\Interfaces\TextMessageSenderInterface;
use App\Entity\PhoneNumber;
use App\Entity\VerificationChallenge;
use Psl\Type;
use Symfony\Contracts\Translation\TranslatorInterface;

final readonly class VerificationCodeTexter
{
    public function __construct(
        private TextMessageSenderInterface $textMessageSender,
        private TranslatorInterface $translator,
    ) {
    }

    /** In the account's language, as the email is. */
    public function send(PhoneNumber $phone, string $code): void
    {
        $this->textMessageSender->send(
            Type\non_empty_string()->assert($phone->getNumber()),
            $this->translator->trans('verification.text', [
                '{code}' => $code,
                '{minutes}' => (string) VerificationChallenge::LIFETIME_MINUTES,
            ], 'emails', $phone->getUser()->getLocale()),
        );
    }
}
