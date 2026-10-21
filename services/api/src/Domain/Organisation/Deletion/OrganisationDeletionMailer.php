<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Deletion;

use App\Deletion\RestoreWindow;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Organisation;
use App\Entity\User;
use DateTimeImmutable;

/** Every member hears that the organisation is gone, and until when support can bring it back, in their own zone. */
final readonly class OrganisationDeletionMailer
{
    public function __construct(
        private UserMailer $userMailer,
    ) {
    }

    /** @param list<User> $members */
    public function sendDeleted(Organisation $organisation, User $by, array $members, DateTimeImmutable $at, ?string $asked = null): void
    {
        foreach ($members as $member) {
            $address = $member->getPrimaryEmailAddress()?->getAddress();

            if (null === $address) {
                continue;
            }

            $locale = $this->userMailer->localeFor($member, $member->getId()->equals($by->getId()) ? $asked : null);
            $named = ['{organisation}' => $organisation->getName()];

            $this->userMailer->send($address, $locale, 'organisationDeleted.subject', [
                $this->userMailer->line('organisationDeleted.body', $locale, [...$named, '{name}' => $by->getName(), '{when}' => $this->userMailer->moment($at, $member, $locale)]),
                $this->userMailer->line('organisationDeleted.restore', $locale, ['{deadline}' => $this->userMailer->deadline(RestoreWindow::closesAt($at), $member, $locale)]),
                '--',
                $this->userMailer->line('organisationDeleted.footer', $locale, $named),
            ], $named);
        }
    }
}
