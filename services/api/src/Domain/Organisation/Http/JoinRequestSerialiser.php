<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Http;

use App\Entity\Membership;
use App\Entity\MembershipTransition;
use App\Entity\Organisation;
use App\Enum\MembershipStatus;
use App\Repository\MembershipTransitionRepository;

/** A request waiting for approval, as the person who asked sees it: whom they asked, and when. */
final readonly class JoinRequestSerialiser
{
    public function __construct(
        private MembershipTransitionRepository $membershipTransitionRepository,
    ) {
    }

    /** @return array{organisation: array{id: string, name: string}, askedAt: string} */
    public function request(Membership $membership): array
    {
        $asked = $this->membershipTransitionRepository->findOneBy(
            ['membership' => $membership, 'toStatus' => MembershipStatus::PendingApproval],
            ['occurredAt' => 'DESC', 'id' => 'DESC'],
        );

        return [
            'organisation' => self::organisation($membership->getOrganisation()),
            'askedAt' => ($asked instanceof MembershipTransition ? $asked->getOccurredAt() : $membership->getCreatedAt())->format(\DATE_ATOM),
        ];
    }

    /** @return array{id: string, name: string} */
    public static function organisation(Organisation $organisation): array
    {
        return ['id' => $organisation->getId()->toRfc4122(), 'name' => $organisation->getName()];
    }
}
