<?php

declare(strict_types=1);

namespace App\Domain\User\Mail;

use App\Entity\User;
use App\Locale\Listener\RequestLocaleListener;
use App\Locale\SupportedLocales;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The one way to choose a person's language (sc-852): theirs, else the one asked in, else the default. */
final readonly class AccountLanguage
{
    public function __construct(
        private TranslatorInterface $translator,
        private RequestStack $requestStack,
    ) {
    }

    /** Inside a request, the translator's language is the request's; after one, it is the default. */
    public function of(User $user, ?string $asked = null): string
    {
        $stored = $user->storedLanguage();

        if (null !== $stored && SupportedLocales::supports($stored)) {
            return SupportedLocales::narrow($stored);
        }

        return SupportedLocales::narrow($asked ?? $this->translator->getLocale());
    }

    /** What a screen writes a date in (sc-9267): the language the request asked for, which a picker switch sends before the account has saved it; else theirs. */
    public function shown(User $user): string
    {
        return self::askedIn($this->requestStack->getMainRequest()) ?? $this->of($user);
    }

    /** @return bool whether it had none, and now has the one asked in */
    /** Only a language the request actually asked for: a request that named none leaves the account to a later one. */
    public static function rememberIfNone(User $user, ?Request $request): bool
    {
        $asked = self::askedIn($request);

        if (null !== $user->storedLanguage() || null === $asked) {
            return false;
        }

        $user->setLocale($asked);

        return true;
    }

    /** What the request named (header or `?locale`), not the default it fell back to; null when it named none. */
    public static function askedIn(?Request $request): ?string
    {
        $asked = $request?->attributes->get(RequestLocaleListener::ASKED);

        return \is_string($asked) ? $asked : null;
    }

    /** What a request's language is stored as: one of the four, the default when it named none of them. */
    public static function fromRequest(?string $asked): string
    {
        return SupportedLocales::narrow($asked);
    }
}
