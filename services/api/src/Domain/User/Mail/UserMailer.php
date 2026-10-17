<?php

declare(strict_types=1);

namespace App\Domain\User\Mail;

use App\Entity\User;
use DateTimeImmutable;
use IntlDateFormatter;
use Psl\Str;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A plain-text email to one person, in their locale, from Soirely's one sender. */
final readonly class UserMailer
{
    private const string DOMAIN = 'emails';

    public function __construct(
        private MailerInterface $mailer,
        private TranslatorInterface $translator,
        private AccountLanguage $accountLanguage,
        private string $mailFrom,
    ) {
    }

    /**
     * @param list<string>          $paragraphs        already in the person's locale, joined by a blank line
     * @param array<string, string> $subjectParameters
     */
    public function send(string $address, ?string $locale, string $subjectKey, array $paragraphs, array $subjectParameters = []): void
    {
        $this->mailer->send(
            new Email()
                ->from(Address::create($this->mailFrom))
                ->to($address)
                ->subject($this->line($subjectKey, $locale, $subjectParameters))
                ->text(Str\join($paragraphs, "\n\n")),
        );
    }

    /**
     * To the person's primary address, or to nobody when they have none.
     *
     * @param list<string> $paragraphs
     */
    public function sendTo(User $user, string $subjectKey, array $paragraphs, ?string $asked = null): void
    {
        $address = $user->getPrimaryEmailAddress()?->getAddress();

        if (null !== $address) {
            $this->send($address, $this->localeFor($user, $asked), $subjectKey, $paragraphs);
        }
    }

    /** The account's own language, or else the one the request that led to this email was made in. */
    public function localeFor(User $user, ?string $asked = null): string
    {
        return $this->accountLanguage->of($user, $asked);
    }

    /** A moment as the reader writes it, in UTC, since a stored instant has no timezone of its own. */
    public function moment(DateTimeImmutable $at, string $locale): string
    {
        return (IntlDateFormatter::create($locale, IntlDateFormatter::LONG, IntlDateFormatter::SHORT, 'UTC')?->format($at) ?: $at->format('Y-m-d H:i')) . ' UTC';
    }

    /** @param array<string, string> $parameters */
    public function line(string $key, ?string $locale, array $parameters = []): string
    {
        return $this->translator->trans($key, $parameters, self::DOMAIN, $locale);
    }

    /** As the devices card words a row: no place, and no claim that either part was checked. */
    public function device(?string $userAgent, ?string $ipAddress, string $locale): string
    {
        $agent = ReadableAgent::of($userAgent);
        $named = null === $agent
            ? $this->line('password.device.unknown', $locale)
            : $this->line('password.device.agent', $locale, ['{browser}' => $agent->browser, '{platform}' => $agent->platform]);

        return null === $ipAddress || '' === $ipAddress
            ? $named
            : $this->line('password.device.from', $locale, ['{device}' => $named, '{address}' => $ipAddress]);
    }
}
