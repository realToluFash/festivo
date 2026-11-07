<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Members;

use App\Entity\Organisation;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Active memberships against the plan's team seats. No plan sets one yet (epic 37): empty means no limit. */
final readonly class TeamSeats
{
    public function __construct(
        private MembershipRepository $membershipRepository,
        private TranslatorInterface $translator,
        private EntityManagerInterface $entityManager,
        private string $teamSeatLimit,
    ) {
    }

    /** Refused `team_seats_in_use`, naming the limit, when every seat is taken. Inside a transaction: the organisation row stays locked until it ends, so two restores never both count the last seat free. */
    public function requireFree(Organisation $organisation): void
    {
        $limit = Str\to_int(Str\trim($this->teamSeatLimit));

        if (null === $limit) {
            return;
        }

        $this->entityManager->lock($organisation, LockMode::PESSIMISTIC_WRITE);

        if ($this->membershipRepository->countActiveIn($organisation) < $limit) {
            return;
        }

        throw new ApiException(
            ErrorCode::TeamSeatsInUse,
            $this->translator->trans('members.seats_in_use', ['count' => $limit]),
            members: ['limit' => $limit],
        );
    }
}
