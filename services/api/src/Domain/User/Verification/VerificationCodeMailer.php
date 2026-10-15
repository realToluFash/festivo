<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Entity\EmailAddress;
use App\Entity\VerificationChallenge;
use Psl\Str;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Contracts\Translation\TranslatorInterface;

final readonly class VerificationCodeMailer
{
    private const string DOMAIN = 'emails';

    public function __construct(
        private MailerInterface $mailer,
        private TranslatorInterface $translator,
        private string $mailFrom,
    ) {
    }

    public function send(EmailAddress $address, string $code): void
    {
        $locale = $address->getUser()->getLocale();

        $this->mailer->send(
            new Email()
                ->from(Address::create($this->mailFrom))
                ->to($address->getAddress())
                ->subject($this->line('verification.subject', $locale))
                ->text($this->body($code, $locale))
        );
    }

    private function body(string $code, ?string $locale): string
    {
        $minutes = (string) VerificationChallenge::LIFETIME_MINUTES;

        return Str\join([
            $this->line('verification.heading', $locale),
            $this->line('verification.body', $locale),
            $code,
            $this->line('verification.expiry', $locale, ['{minutes}' => $minutes]),
            $this->line('verification.ignore', $locale),
        ], "\n\n");
    }

    /** @param array<string, string> $parameters */
    private function line(string $key, ?string $locale, array $parameters = []): string
    {
        return $this->translator->trans($key, $parameters, self::DOMAIN, $locale);
    }
}
