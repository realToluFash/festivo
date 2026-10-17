<?php

declare(strict_types=1);

namespace App\Domain\User\Recovery;

use App\Domain\User\Mail\UserMailer;
use App\Entity\PasswordResetToken;
use App\Entity\User;
use DateTimeImmutable;
use IntlDateFormatter;
use Psl\Str;
use SensitiveParameter;

/** The three things recovery sends: a link, how a provider account signs in, and that a password changed. */
final readonly class RecoveryMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private string $webOrigin,
    ) {
    }

    public function sendLink(User $user, #[SensitiveParameter] string $token): void
    {
        $locale = $user->getLocale();
        $link = Str\trim_right($this->webOrigin, '/') . '/reset-password?token=' . \rawurlencode($token);

        $this->userMailer->sendTo($user, 'recovery.link.subject', [
            $this->line('recovery.link.heading', $locale),
            $this->line('recovery.link.body', $locale),
            $link,
            $this->line('recovery.link.expiry', $locale, ['{minutes}' => (string) PasswordResetToken::LIFETIME_MINUTES]),
            $this->line('recovery.link.ignore', $locale),
        ]);
    }

    /** @param list<string> $providers the names the person signs in with, such as Google */
    public function sendHowYouSignIn(User $user, array $providers): void
    {
        $locale = $user->getLocale();

        $this->userMailer->sendTo($user, 'recovery.provider.subject', [
            $this->line('recovery.provider.body', $locale, [
                '{providers}' => Str\join($providers, $this->line('recovery.or', $locale)),
            ]),
            $this->line('recovery.provider.ignore', $locale),
        ]);
    }

    public function sendChanged(User $user, DateTimeImmutable $at): void
    {
        $locale = $user->getLocale();
        $when = IntlDateFormatter::create($locale ?? 'en', IntlDateFormatter::LONG, IntlDateFormatter::SHORT, 'UTC')?->format($at) ?? $at->format('Y-m-d H:i');

        $this->userMailer->sendTo($user, 'recovery.changed.subject', [
            $this->line('recovery.changed.body', $locale, ['{when}' => $when . ' UTC']),
            $this->line('recovery.changed.notYou', $locale),
        ]);
    }

    /** @param array<string, string> $parameters */
    private function line(string $key, ?string $locale, array $parameters = []): string
    {
        return $this->userMailer->line($key, $locale, $parameters);
    }
}
