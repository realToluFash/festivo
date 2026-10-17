<?php

declare(strict_types=1);

namespace App\Domain\User\Password;

use App\Domain\User\Mail\ReadableAgent;
use App\Domain\User\Mail\UserMailer;
use App\Entity\User;
use DateTimeImmutable;
use Psl\Str;

/** That the password was changed, when and from what device, so a person who did not do it finds out in time. */
final readonly class PasswordChangeMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private string $webOrigin,
    ) {
    }

    public function sendChanged(User $user, DateTimeImmutable $at, ?string $userAgent, ?string $ipAddress): void
    {
        $locale = $this->userMailer->localeFor($user);

        $this->userMailer->sendTo($user, 'password.changed.subject', [
            $this->userMailer->line('password.changed.body', $locale, ['{when}' => $this->userMailer->moment($at, $locale)]),
            $this->userMailer->line('password.changed.where', $locale, ['{device}' => $this->device($userAgent, $ipAddress, $locale)]),
            $this->userMailer->line('password.changed.devices', $locale),
            $this->userMailer->line('password.changed.notYou', $locale),
            Str\trim_right($this->webOrigin, '/') . '/sign-in',
        ], $locale);
    }

    /** As the devices card words a row: no place, and no claim that either part was checked. */
    private function device(?string $userAgent, ?string $ipAddress, string $locale): string
    {
        $agent = ReadableAgent::of($userAgent);
        $named = null === $agent
            ? $this->userMailer->line('password.device.unknown', $locale)
            : $this->userMailer->line('password.device.agent', $locale, ['{browser}' => $agent->browser, '{platform}' => $agent->platform]);

        return null === $ipAddress || '' === $ipAddress
            ? $named
            : $this->userMailer->line('password.device.from', $locale, ['{device}' => $named, '{address}' => $ipAddress]);
    }
}
