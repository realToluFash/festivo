<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Domain\User\Mail\MailCode;
use App\Domain\User\Mail\UserMailer;
use App\Entity\EmailAddress;
use App\Entity\VerificationChallenge;
use App\Enum\AccountMail;
use Doctrine\ORM\EntityManagerInterface;

final readonly class VerificationCodeMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private VerificationCodeIssuer $verificationCodeIssuer,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** A new code for the address, and its email, committed together. */
    public function issue(EmailAddress $address): void
    {
        $this->entityManager->wrapInTransaction(function () use ($address): void {
            $issued = $this->verificationCodeIssuer->issueFor($address);
            $this->entityManager->flush();
            $this->send($address, $issued->code);
        });
    }

    public function send(EmailAddress $address, string $code): void
    {
        $locale = $this->userMailer->localeFor($address->getUser());
        $minutes = (string) VerificationChallenge::LIFETIME_MINUTES;

        $this->userMailer->send(AccountMail::VerificationCode, $address->getAddress(), $locale, 'verification.subject', [
            $this->userMailer->line('verification.heading', $locale),
            $this->userMailer->line('verification.body', $locale),
            $code,
            $this->userMailer->line('verification.expiry', $locale, ['{minutes}' => $minutes]),
            $this->userMailer->line('verification.ignore', $locale),
        ], code: new MailCode($code, VerificationChallenge::LIFETIME_MINUTES));
    }
}
