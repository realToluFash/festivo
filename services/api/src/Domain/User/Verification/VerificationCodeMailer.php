<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Domain\User\Mail\MailCode;
use App\Domain\User\Mail\UserMailer;
use App\Entity\EmailAddress;
use App\Entity\VerificationChallenge;
use App\Enum\AccountMail;

final readonly class VerificationCodeMailer
{
    public function __construct(
        private UserMailer $userMailer,
    ) {
    }

    public function send(EmailAddress $address, string $code): void
    {
        $locale = $this->userMailer->localeFor($address->getUser());
        $minutes = (string) VerificationChallenge::LIFETIME_MINUTES;

        $this->userMailer->send(AccountMail::VerificationCode, $address->getAddress(), $locale, 'verification.subject', [
            $this->userMailer->line('verification.heading', $locale),
            $this->userMailer->line('verification.body', $locale),
            $code,
            $this->userMailer->line('verification.expiry', $locale, ['{minutes}' => $minutes]),
            $this->userMailer->line('verification.ignore', $locale),
        ], code: new MailCode($code, VerificationChallenge::LIFETIME_MINUTES));
    }
}
