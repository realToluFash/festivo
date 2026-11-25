<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Domain\Staff\Model\StaffDetails;
use App\Entity\Organisation;
use App\Entity\User;
use App\Repository\MembershipRepository;
use Psl\Iter;

/** The organisation's member a roster entry is linked to: whoever has verified its mobile number, else its email (sc-3906). Being linked grants them nothing. */
final readonly class RosterMemberMatch
{
    public function __construct(
        private VerifiedContactOwners $verifiedContactOwners,
        private MembershipRepository $membershipRepository,
    ) {
    }

    public function of(Organisation $organisation, StaffDetails $details): ?User
    {
        return Iter\search(
            $this->verifiedContactOwners->of($details->mobile, $details->email),
            fn (User $owner): bool => null !== $this->membershipRepository->findActive($owner, $organisation->getId()),
        );
    }
}
