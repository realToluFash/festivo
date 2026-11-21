<?php

declare(strict_types=1);

namespace App\Domain\Organisation\EmailDomains;

use App\Domain\User\Mail\UserMailer;
use App\Entity\EmailDomain;
use App\Enum\AccountMail;
use App\Repository\EmailAddressRepository;
use DateTimeImmutable;

/** `managed_notice` (sc-563): every account whose verified main address is at the domain, the instant in its own zone. */
final readonly class ManagedNoticeMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private EmailAddressRepository $emailAddressRepository,
    ) {
    }

    /** @return int how many were emailed */
    public function send(EmailDomain $domain, DateTimeImmutable $from): int
    {
        $sent = 0;

        foreach ($this->emailAddressRepository->findVerifiedPrimariesAt($domain->getDomain()) as $address) {
            $user = $address->getUser();
            $locale = $this->userMailer->localeFor($user);
            $named = [
                '{organisation}' => $domain->getOrganisation()->getName(),
                '{domain}' => $domain->getDomain(),
                '{deadline}' => $this->userMailer->deadline($from, $user, $locale),
            ];

            $this->userMailer->send(AccountMail::ManagedNotice, $address->getAddress(), $locale, 'managedNotice.subject', [
                $this->userMailer->line('managedNotice.body', $locale, $named),
                $this->userMailer->line('managedNotice.from', $locale, $named),
                $this->userMailer->line('managedNotice.events', $locale, $named),
                '--',
                $this->userMailer->line('managedNotice.footer', $locale, $named),
            ], $named);
            ++$sent;
        }

        return $sent;
    }
}
