<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Domain\User\Mail\UserMailer;
use App\Entity\EmailAddress;
use App\Entity\VerificationChallenge;

final readonly class VerificationCodeMailer
{
    public function __construct(
        private UserMailer $userMailer,
    ) {
    }

    public function send(EmailAddress $address, string $code): void
    {
        $locale = $address->getUser()->getLocale();
        $minutes = (string) VerificationChallenge::LIFETIME_MINUTES;

        $this->userMailer->send($address->getAddress(), $locale, 'verification.subject', [
            $this->userMailer->line('verification.heading', $locale),
            $this->userMailer->line('verification.body', $locale),
            $code,
            $this->userMailer->line('verification.expiry', $locale, ['{minutes}' => $minutes]),
            $this->userMailer->line('verification.ignore', $locale),
        ]);
    }
}
