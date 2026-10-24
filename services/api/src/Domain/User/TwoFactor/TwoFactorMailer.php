<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use App\Domain\User\Mail\UserMailer;
use App\Entity\User;
use DateTimeImmutable;

/** That two-factor was turned on or off, and when, so a person who did not do it finds out. */
final readonly class TwoFactorMailer
{
    public function __construct(
        private UserMailer $userMailer,
    ) {
    }

    public function sendTurnedOn(User $user, DateTimeImmutable $at): void
    {
        $locale = $this->userMailer->localeFor($user);
        $when = $this->userMailer->moment($at, $user, $locale);

        $this->userMailer->sendTo($user, 'twoFactor.on.subject', [
            $this->userMailer->line('twoFactor.on.body', $locale, ['{when}' => $when]),
            $this->userMailer->line('twoFactor.on.notYou', $locale),
        ]);
    }

    public function sendTurnedOff(User $user, DateTimeImmutable $at): void
    {
        $locale = $this->userMailer->localeFor($user);
        $when = $this->userMailer->moment($at, $user, $locale);

        $this->userMailer->sendTo($user, 'twoFactor.off.subject', [
            $this->userMailer->line('twoFactor.off.body', $locale, ['{when}' => $when]),
            $this->userMailer->line('twoFactor.off.notYou', $locale),
        ]);
    }
}
