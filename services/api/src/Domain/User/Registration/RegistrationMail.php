<?php

declare(strict_types=1);

namespace App\Domain\User\Registration;

use App\Domain\User\Mail\MailCode;
use App\Domain\User\Mail\UserMailer;
use App\Entity\VerificationChallenge;
use App\Enum\AccountMail;
use Psl\Str;
use SensitiveParameter;

/** The two emails a sign-up sends, both queued the same way, so the request's cost says nothing about the address. */
final readonly class RegistrationMail
{
    public function __construct(
        private UserMailer $userMailer,
        private string $webOrigin,
    ) {
    }

    public function code(string $to, ?string $locale, #[SensitiveParameter] string $code): void
    {
        $this->userMailer->send(AccountMail::SignUpCode, $to, $locale, 'verification.subject', [
            $this->userMailer->line('verification.heading', $locale),
            $this->userMailer->line('verification.body', $locale),
            $code,
            $this->userMailer->line('verification.expiry', $locale, ['{minutes}' => (string) VerificationChallenge::LIFETIME_MINUTES]),
            $this->userMailer->line('verification.ignore', $locale),
        ], code: new MailCode($code, VerificationChallenge::LIFETIME_MINUTES));
    }

    public function alreadyRegistered(string $to, ?string $locale): void
    {
        $origin = Str\trim_right($this->webOrigin, '/');

        $this->userMailer->send(AccountMail::AlreadyRegistered, $to, $locale, 'alreadyRegistered.subject', [
            $this->userMailer->line('alreadyRegistered.body', $locale),
            $this->userMailer->line('alreadyRegistered.signIn', $locale) . ' ' . $origin . '/sign-in',
            $this->userMailer->line('alreadyRegistered.reset', $locale) . ' ' . $origin . '/forgot-password',
            $this->userMailer->line('alreadyRegistered.ignore', $locale),
        ]);
    }
}
