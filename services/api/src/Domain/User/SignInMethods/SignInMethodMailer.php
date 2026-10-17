<?php

declare(strict_types=1);

namespace App\Domain\User\SignInMethods;

use App\Domain\User\Mail\UserMailer;
use App\Entity\User;
use App\Enum\IdentityProvider;
use DateTimeImmutable;
use Psl\Str;

/** Every verified address hears when a provider is bound or removed, as NIST SP 800-63B §6.1.2 asks. */
final readonly class SignInMethodMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private string $webOrigin,
    ) {
    }

    /** `$asked` is the language it was done in: these sends run after the response, which has forgotten it. */
    public function sendLinked(User $user, IdentityProvider $provider, ?string $vouchedFor, DateTimeImmutable $at, ?string $userAgent, ?string $ipAddress, ?string $asked = null): void
    {
        $this->sendToEveryVerified($user, 'provider.linked', $provider, $vouchedFor, $at, $userAgent, $ipAddress, $asked);
    }

    public function sendUnlinked(User $user, IdentityProvider $provider, ?string $vouchedFor, DateTimeImmutable $at, ?string $userAgent, ?string $ipAddress, ?string $asked = null): void
    {
        $this->sendToEveryVerified($user, 'provider.unlinked', $provider, $vouchedFor, $at, $userAgent, $ipAddress, $asked);
    }

    private function sendToEveryVerified(User $user, string $key, IdentityProvider $provider, ?string $vouchedFor, DateTimeImmutable $at, ?string $userAgent, ?string $ipAddress, ?string $asked): void
    {
        $locale = $this->userMailer->localeFor($user, $asked);
        $name = ['{provider}' => self::nameOf($provider)];
        $paragraphs = [
            $this->userMailer->line($key . '.body', $locale, $name),
            ...(null === $vouchedFor ? [] : [$this->userMailer->line('provider.account', $locale, [...$name, '{address}' => $vouchedFor])]),
            $this->userMailer->line('provider.when', $locale, ['{when}' => $this->userMailer->moment($at, $user, $locale)]),
            $this->userMailer->line('password.changed.where', $locale, ['{device}' => $this->userMailer->device($userAgent, $ipAddress, $locale)]),
            $this->userMailer->line('provider.security', $locale) . ' ' . Str\trim_right($this->webOrigin, '/') . '/app/account/security',
            $this->userMailer->line($key . '.notYou', $locale, $name),
            $this->userMailer->line('provider.why', $locale),
        ];

        foreach ($user->getEmailAddresses() as $address) {
            if ($address->isVerified()) {
                $this->userMailer->send($address->getAddress(), $locale, $key . '.subject', $paragraphs, $name);
            }
        }
    }

    private static function nameOf(IdentityProvider $provider): string
    {
        return match ($provider) {
            IdentityProvider::Google => 'Google',
            IdentityProvider::Apple => 'Apple',
        };
    }
}
