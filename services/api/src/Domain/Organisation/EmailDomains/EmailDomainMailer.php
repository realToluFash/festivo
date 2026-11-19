<?php

declare(strict_types=1);

namespace App\Domain\Organisation\EmailDomains;

use App\Domain\User\Mail\UserMailer;
use App\Entity\EmailDomain;
use App\Entity\Organisation;
use App\Enum\AccountMail;
use App\Repository\MembershipRepository;

/** `domain_listing_stopped` and `domain_record_gone` (sc-560): each owner and admin, each instant in their own zone. */
final readonly class EmailDomainMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private MembershipRepository $membershipRepository,
    ) {
    }

    /** Once, when the domain is proved, to an organisation whose company domain joining listing of it stops. */
    public function listingStopped(Organisation $listing, EmailDomain $proved): void
    {
        $named = [
            '{domain}' => $proved->getDomain(),
            '{organisation}' => $listing->getName(),
            '{prover}' => $proved->getOrganisation()->getName(),
        ];

        foreach ($this->membershipRepository->findAdministratorsIn($listing) as $administrator) {
            $address = $administrator->getUser()->getPrimaryEmailAddress()?->getAddress();

            if (null === $address) {
                continue;
            }

            $locale = $this->userMailer->localeFor($administrator->getUser());
            $this->userMailer->send(AccountMail::DomainListingStopped, $address, $locale, 'domainListingStopped.subject', [
                $this->userMailer->line('domainListingStopped.body', $locale, $named),
                $this->userMailer->line('domainListingStopped.members', $locale, $named),
                '--',
                $this->userMailer->line('domainListingStopped.footer', $locale, $named),
            ], $named);
        }
    }

    /** When a proved domain's record is first found missing, with the instant it must be back by. */
    public function recordGone(EmailDomain $domain): void
    {
        $putBackBy = $domain->putBackBy();

        if (null === $putBackBy) {
            return;
        }

        $organisation = $domain->getOrganisation();
        $named = ['{domain}' => $domain->getDomain(), '{organisation}' => $organisation->getName()];

        foreach ($this->membershipRepository->findAdministratorsIn($organisation) as $administrator) {
            $user = $administrator->getUser();
            $address = $user->getPrimaryEmailAddress()?->getAddress();

            if (null === $address) {
                continue;
            }

            $locale = $this->userMailer->localeFor($user);
            $this->userMailer->send(AccountMail::DomainRecordGone, $address, $locale, 'domainRecordGone.subject', [
                $this->userMailer->line('domainRecordGone.body', $locale, [...$named, '{deadline}' => $this->userMailer->deadline($putBackBy, $user, $locale)]),
                $this->userMailer->line('domainRecordGone.name', $locale, ['{name}' => EmailDomains::recordName($domain->getDomain())]),
                $this->userMailer->line('domainRecordGone.type', $locale),
                '--',
                $this->userMailer->line('domainRecordGone.footer', $locale, $named),
            ], $named);
        }
    }
}
