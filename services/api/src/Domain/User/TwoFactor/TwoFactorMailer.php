<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use App\Domain\User\Mail\UserMailer;
use App\Entity\User;
use DateTimeImmutable;
use IntlDateFormatter;

/** That two-factor was turned off, and when, so a person who did not do it finds out. */
final readonly class TwoFactorMailer
{
    public function __construct(
        private UserMailer $userMailer,
    ) {
    }

    public function sendTurnedOff(User $user, DateTimeImmutable $at): void
    {
        $locale = $user->getLocale();
        $when = IntlDateFormatter::create($locale ?? 'en', IntlDateFormatter::LONG, IntlDateFormatter::SHORT, 'UTC')?->format($at) ?? $at->format('Y-m-d H:i');

        $this->userMailer->sendTo($user, 'twoFactor.off.subject', [
            $this->userMailer->line('twoFactor.off.body', $locale, ['{when}' => $when . ' UTC']),
            $this->userMailer->line('twoFactor.off.notYou', $locale),
        ]);
    }
}
