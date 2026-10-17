<?php

declare(strict_types=1);

namespace App\Domain\User\Mail;

use App\Entity\User;
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
        private string $mailFrom,
    ) {
    }

    /** @param list<string> $paragraphs already in the person's locale, joined by a blank line */
    public function send(string $address, ?string $locale, string $subjectKey, array $paragraphs): void
    {
        $this->mailer->send(
            new Email()
                ->from(Address::create($this->mailFrom))
                ->to($address)
                ->subject($this->line($subjectKey, $locale))
                ->text(Str\join($paragraphs, "\n\n")),
        );
    }

    /**
     * To the person's primary address, or to nobody when they have none.
     *
     * @param list<string> $paragraphs
     */
    public function sendTo(User $user, string $subjectKey, array $paragraphs): void
    {
        $address = $user->getPrimaryEmailAddress()?->getAddress();

        if (null !== $address) {
            $this->send($address, $user->getLocale(), $subjectKey, $paragraphs);
        }
    }

    /** @param array<string, string> $parameters */
    public function line(string $key, ?string $locale, array $parameters = []): string
    {
        return $this->translator->trans($key, $parameters, self::DOMAIN, $locale);
    }
}
