<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SignInRules;

use App\Audit\Auditor;
use App\Repository\MembershipRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/** The audit line for each member the deadline for two-factor of everyone holds back (sc-609); the hold itself needs no run. */
final readonly class TwoFactorHolds
{
    public const string HELD = 'sign_in_rules.two_factor_held';

    public const string SUBJECT = 'Membership';

    public function __construct(
        private MembershipRepository $membershipRepository,
        private SignInRules $signInRules,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    /** @return int how many were recorded */
    public function recordDue(): int
    {
        $recorded = 0;

        foreach ($this->membershipRepository->findHeldForTwoFactorUnrecorded($this->signInRules->twoFactorGraceStartedBefore()) as $membership) {
            $membership->setTwoFactorBlockedAt($this->clock->now());
            $this->auditor->record(self::HELD, self::SUBJECT, $membership->getId(), changes: [
                'organisation' => [null, $membership->getOrganisation()->getId()->toRfc4122()],
                'user' => [null, $membership->getUser()->getId()->toRfc4122()],
            ]);
            ++$recorded;
        }

        $this->entityManager->flush();

        return $recorded;
    }
}
