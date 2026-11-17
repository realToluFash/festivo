<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Domain\Staff\Model\StaffDetails;
use App\Entity\Organisation;
use App\Entity\User;
use App\Repository\EmailAddressRepository;
use App\Repository\MembershipRepository;
use App\Repository\PhoneNumberRepository;

/** The organisation's member a roster entry is linked to: whoever has verified its mobile number, else its email (sc-3906). Being linked grants them nothing. */
final readonly class RosterMemberMatch
{
    public function __construct(
        private PhoneNumberRepository $phoneNumberRepository,
        private EmailAddressRepository $emailAddressRepository,
        private MembershipRepository $membershipRepository,
    ) {
    }

    public function of(Organisation $organisation, StaffDetails $details): ?User
    {
        $byPhone = null === $details->mobile ? null : $this->phoneNumberRepository->findOneByNumber($details->mobile);
        $byEmail = null === $details->email ? null : $this->emailAddressRepository->findOneByAddress($details->email);

        foreach ([$byPhone, $byEmail] as $contact) {
            if (null !== $contact && $contact->isVerified() && null !== $this->membershipRepository->findActive($contact->getUser(), $organisation->getId())) {
                return $contact->getUser();
            }
        }

        return null;
    }
}
