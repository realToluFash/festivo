<?php

declare(strict_types=1);

namespace App\Domain\User\Mail;

use App\Entity\PhoneNumber;
use App\Entity\PhoneSignIn;
use App\Entity\TextableContact;
use App\Entity\User;
use App\Locale\Listener\RequestLocaleListener;
use App\Locale\SupportedLocales;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The one way to choose a person's language: for anything sent, theirs first (sc-852); for an answer they read, the one asked in first (sc-9267). */
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

    /** A code's text in its account's language; a number with no account yet in the language it asked in (sc-4235). */
    public function ofContact(TextableContact $contact): string
    {
        return match (true) {
            $contact instanceof PhoneNumber => $this->of($contact->getUser()),
            $contact instanceof PhoneSignIn => SupportedLocales::narrow($contact->getLocale()),
            default => SupportedLocales::narrow($this->translator->getLocale()),
        };
    }

    /** What a screen writes a date in (sc-9267, sc-65714): the request's formatting tag when it asked for a language; else theirs. */
    public function shown(User $user): string
    {
        return null === self::askedIn($this->requestStack->getMainRequest()) ? $this->of($user) : $this->answeredFormatting();
    }

    /** The request's language with the device's region while the device speaks it, for a date a screen shows. */
    public function answeredFormatting(): string
    {
        $formatting = $this->requestStack->getMainRequest()?->attributes->get(RequestLocaleListener::FORMATTING);

        return \is_string($formatting) ? $formatting : $this->answered();
    }

    /** What the API's own sentences are in (sc-10700), and so a date written inside one (sc-11329): the language the listener settled for the request, which its `detail` is translated in; never the account's. */
    public function answered(): string
    {
        $answered = $this->requestStack->getMainRequest()?->attributes->get(RequestLocaleListener::ATTRIBUTE);

        return \is_string($answered) ? SupportedLocales::narrow($answered) : SupportedLocales::DEFAULT;
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
