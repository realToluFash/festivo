<?php

declare(strict_types=1);

namespace App\Domain\User\Password;

use App\Domain\User\Mail\UserMailer;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use DateTimeImmutable;
use Psl\Str;
use SensitiveParameter;

/** That the password was changed or added, when and from what device, so a person who did not do it finds out in time. */
final readonly class PasswordChangeMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private string $webOrigin,
    ) {
    }

    /** `$asked` is the language the change was made in: the send runs after the response, which has forgotten it. */
    public function sendChanged(User $user, DateTimeImmutable $at, ?string $userAgent, ?string $ipAddress, ?string $asked = null): void
    {
        $locale = $this->userMailer->localeFor($user, $asked);

        $this->userMailer->sendTo($user, 'password.changed.subject', [
            $this->userMailer->line('password.changed.body', $locale, ['{when}' => $this->userMailer->moment($at, $locale)]),
            $this->userMailer->line('password.changed.where', $locale, ['{device}' => $this->userMailer->device($userAgent, $ipAddress, $locale)]),
            $this->userMailer->line('password.changed.devices', $locale),
            $this->userMailer->line('password.changed.notYou', $locale),
            Str\trim_right($this->webOrigin, '/') . '/sign-in',
        ], $locale);
    }

    /** The code that proves the address before a Google or Apple account adds a password. */
    public function sendCode(User $user, #[SensitiveParameter] string $code, ?string $asked = null): void
    {
        $locale = $this->userMailer->localeFor($user, $asked);

        $this->userMailer->sendTo($user, 'password.code.subject', [
            $this->userMailer->line('password.code.body', $locale),
            $code,
            $this->userMailer->line('password.code.expiry', $locale, ['{minutes}' => (string) VerificationChallenge::LIFETIME_MINUTES]),
            $this->userMailer->line('password.code.ignore', $locale),
        ], $locale);
    }

    /** `$asked` is the language it was done in: these sends run after the response, which has forgotten it. */
    public function sendAdded(User $user, DateTimeImmutable $at, ?string $userAgent, ?string $ipAddress, ?string $asked = null): void
    {
        $locale = $this->userMailer->localeFor($user, $asked);

        $this->userMailer->sendTo($user, 'password.added.subject', [
            $this->userMailer->line('password.added.body', $locale, ['{when}' => $this->userMailer->moment($at, $locale)]),
            $this->userMailer->line('password.changed.where', $locale, ['{device}' => $this->userMailer->device($userAgent, $ipAddress, $locale)]),
            $this->userMailer->line('password.added.notYou', $locale),
            Str\trim_right($this->webOrigin, '/') . '/sign-in',
        ], $locale);
    }
}
