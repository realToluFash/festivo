<?php

declare(strict_types=1);

namespace App\Domain\Organisation\DomainJoining;

use App\Entity\Membership;
use App\Enum\MembershipStatus;
use App\Repository\MembershipRepository;
use DateInterval;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** A suspension's 30 days run only beside another active Owner, starting afresh when one arrives (sc-564). Flushing is the caller's. */
final readonly class RemovalClock
{
    public function __construct(
        private MembershipRepository $membershipRepository,
        private ClockInterface $clock,
    ) {
    }

    /** After any move or role change: the owners are read as they stand in memory, so it runs before the flush. */
    public function wind(Membership $changed, bool $wasOwner = false): void
    {
        if ($wasOwner || $changed->getRole()->isOwner()) {
            $owners = Vec\filter(
                Vec\unique_by([$changed, ...$this->membershipRepository->findOwnersIn($changed->getOrganisation())], static fn (Membership $owner): string => $owner->getId()->toRfc4122()),
                static fn (Membership $owner): bool => $owner->getRole()->isOwner(),
            );
            $alone = !Iter\any($owners, static fn (Membership $owner): bool => $owner->isActive());

            foreach ($owners as $owner) {
                $this->start($owner, held: $alone);
            }
        }

        if (!$changed->getRole()->isOwner()) {
            $this->start($changed, held: false);
        }
    }

    private function start(Membership $membership, bool $held): void
    {
        if (MembershipStatus::Suspended !== $membership->getStatus()) {
            return;
        }

        if ($held) {
            $membership->setRemovesAt(null);
        } elseif (null === $membership->getRemovesAt()) {
            $membership->setRemovesAt($this->clock->now()->add(new DateInterval(Membership::UNANSWERED_FOR)));
        }
    }
}
