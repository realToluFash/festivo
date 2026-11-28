<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use App\Domain\User\Mail\UserMailer;
use App\Domain\User\TwoFactor\Passkey\PasskeyProviders;
use App\Entity\Passkey;
use App\Entity\User;
use App\Enum\AccountMail;
use DateTimeImmutable;

/** That two-factor, or one of its factors, changed, and when, so a person who did not do it finds out. */
final readonly class TwoFactorMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private PasskeyProviders $passkeyProviders,
    ) {
    }

    public function sendTurnedOn(User $user, DateTimeImmutable $at, ?string $asked = null, bool $passkey = false): void
    {
        $locale = $this->userMailer->localeFor($user, $asked);
        $when = $this->userMailer->moment($at, $user, $locale);

        $this->userMailer->sendTo(AccountMail::TwoFactor, $user, 'twoFactor.on.subject', [
            $this->userMailer->line($passkey ? 'twoFactor.on.bodyPasskey' : 'twoFactor.on.body', $locale, ['{when}' => $when]),
            $this->userMailer->line($passkey ? 'twoFactor.on.notYouPasskey' : 'twoFactor.on.notYou', $locale),
        ], $locale);
    }

    public function sendTurnedOff(User $user, DateTimeImmutable $at): void
    {
        $locale = $this->userMailer->localeFor($user);
        $when = $this->userMailer->moment($at, $user, $locale);

        $this->userMailer->sendTo(AccountMail::TwoFactor, $user, 'twoFactor.off.subject', [
            $this->userMailer->line('twoFactor.off.body', $locale, ['{when}' => $when]),
            $this->userMailer->line('twoFactor.off.notYou', $locale),
        ]);
    }

    /** A passkey, or the authenticator app when `$passkey` is null. */
    public function sendAdded(User $user, ?Passkey $passkey, DateTimeImmutable $at, ?string $userAgent, ?string $asked = null): void
    {
        $this->sendChanged('twoFactor.added', $user, $passkey, $at, $userAgent, $asked);
    }

    public function sendRemoved(User $user, ?Passkey $passkey, DateTimeImmutable $at, ?string $userAgent, ?string $asked = null): void
    {
        $this->sendChanged('twoFactor.removed', $user, $passkey, $at, $userAgent, $asked);
    }

    private function sendChanged(string $key, User $user, ?Passkey $passkey, DateTimeImmutable $at, ?string $userAgent, ?string $asked): void
    {
        $locale = $this->userMailer->localeFor($user, $asked);
        $provider = null === $passkey ? null : $this->passkeyProviders->nameOf($passkey->getAaguid());
        $factor = match (true) {
            null === $passkey => $this->userMailer->line('twoFactor.factor.app', $locale),
            null === $provider => $this->userMailer->line('twoFactor.factor.passkey', $locale),
            default => $this->userMailer->line('twoFactor.factor.passkeyIn', $locale, ['{provider}' => $provider]),
        };

        $this->userMailer->sendTo(AccountMail::TwoFactor, $user, $key . '.subject', [
            $this->userMailer->line($key . '.body', $locale, ['{factor}' => $factor, '{when}' => $this->userMailer->moment($at, $user, $locale)]),
            $this->userMailer->line('newDevice.device', $locale, ['{device}' => $this->userMailer->named($userAgent, $locale)]),
            $this->userMailer->line($key . '.notYou', $locale),
        ], $locale);
    }
}
