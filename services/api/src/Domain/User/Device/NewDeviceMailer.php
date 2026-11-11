<?php

declare(strict_types=1);

namespace App\Domain\User\Device;

use App\Domain\User\Mail\UserMailer;
use App\Entity\User;
use DateTimeImmutable;
use Psl\Str;

/** "New sign-in to Soirely", to the primary address, as `Emails-*` draws `new_signin` in plain text. */
final readonly class NewDeviceMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private string $webOrigin,
    ) {
    }

    /** `$asked` is the language the sign-in was made in: the send runs after the response, which has forgotten it. */
    public function send(User $user, DateTimeImmutable $at, ?string $userAgent, ?string $ipAddress, ?string $asked = null): void
    {
        $locale = $this->userMailer->localeFor($user, $asked);
        $facts = [
            $this->userMailer->line('newDevice.when', $locale, ['{when}' => $this->userMailer->deadline($at, $user, $locale)]),
            $this->userMailer->line('newDevice.device', $locale, ['{device}' => $this->userMailer->named($userAgent, $locale)]),
            ...(null === $ipAddress || '' === $ipAddress ? [] : [$this->userMailer->line('newDevice.address', $locale, ['{address}' => $ipAddress])]),
        ];

        $this->userMailer->sendTo($user, 'newDevice.subject', [
            $this->userMailer->line('newDevice.body', $locale),
            Str\join($facts, "\n"),
            $this->userMailer->line('newDevice.review', $locale) . ' ' . Str\trim_right($this->webOrigin, '/') . '/app/account/security',
            $this->userMailer->line(null === $user->getPassword() ? 'newDevice.notYouNoPassword' : 'newDevice.notYou', $locale),
            "--\n" . $this->userMailer->line('newDevice.why', $locale),
        ], $asked);
    }
}
