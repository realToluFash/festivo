<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Domain\Staff\Model\StaffDetails;
use App\Entity\Organisation;
use App\Entity\User;
use App\Repository\MembershipRepository;

/** The organisation's member a roster entry is linked to: whoever has verified its mobile number, else its email (sc-3906). Being linked grants them nothing. */
final readonly class RosterMemberMatch
{
    public function __construct(
        private VerifiedContactOwner $verifiedContactOwner,
        private MembershipRepository $membershipRepository,
    ) {
    }

    public function of(Organisation $organisation, StaffDetails $details): ?User
    {
        $owner = $this->verifiedContactOwner->of($details->mobile, $details->email);

        return null !== $owner && null !== $this->membershipRepository->findActive($owner, $organisation->getId()) ? $owner : null;
    }
}
