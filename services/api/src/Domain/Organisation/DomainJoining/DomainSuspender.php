<?php

declare(strict_types=1);

namespace App\Domain\Organisation\DomainJoining;

use App\Audit\Auditor;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\Members\MemberSuspension;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\Suspension;
use App\Http\AfterResponse;
use App\Repository\MembershipRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** A domain member keeps access only while the domain still brings them in (sc-564). Flushing is the caller's, but for removeExpired. */
final readonly class DomainSuspender
{
    public const string SUBJECT = 'Membership';
    public const string EXPIRED = 'membership.suspension_expired';

    public function __construct(
        private MembershipRepository $membershipRepository,
        private MembershipMachine $membershipMachine,
        private DomainSuspensionMailer $domainSuspensionMailer,
        private Auditor $auditor,
        private AfterResponse $afterResponse,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    /** After the primary address changes or goes: unlinking a sign-in provider never comes here, the tie is to the address. */
    public function addressChanged(User $user): void
    {
        $domain = JoinOfferFinder::domainFor($user);

        foreach ($this->membershipRepository->findActiveFor($user) as $membership) {
            if (null !== $membership->getDomain() && $membership->getDomain() !== $domain) {
                $this->suspend($membership, Suspension::AddressGone, $user);
            }
        }
    }

    public function domainClosed(Organisation $organisation, string $domain, User $by): void
    {
        foreach ($this->membershipRepository->findActiveAtDomain($domain, $organisation) as $membership) {
            $this->suspend($membership, Suspension::DomainClosed, $by);
        }
    }

    /** Another organisation proved the domain on Enterprise (sc-560): every other organisation's domain members pause. */
    public function domainProved(OrganisationDomain $proved): void
    {
        foreach ($this->membershipRepository->findActiveAtDomain($proved->getDomain(), $proved->getOrganisation(), elsewhere: true) as $membership) {
            $this->suspend($membership, Suspension::DomainManagedElsewhere, null);
        }
    }

    /** @return int how many were removed, each as of its own instant rather than this run, as JoinRequests::expireDue does a request */
    public function removeExpired(?Organisation $organisation = null, ?User $user = null): int
    {
        $removed = 0;

        foreach ($this->membershipRepository->findDueForRemoval($this->clock->now(), $organisation, $user) as $membership) {
            $removed += $this->entityManager->wrapInTransaction(function () use ($membership): int {
                $this->entityManager->refresh($membership, LockMode::PESSIMISTIC_WRITE);
                $suspension = $membership->getSuspension();
                $at = $membership->getRemovesAt();

                if (MembershipStatus::Suspended !== $membership->getStatus() || null === $at || $at > $this->clock->now()) {
                    return 0;
                }

                $this->membershipMachine->move($membership, MembershipStatus::LeftOrRemoved, MembershipChannel::Domain, null, $at);
                $this->auditor->record(self::EXPIRED, self::SUBJECT, $membership->getId(), changes: [
                    'status' => [MembershipStatus::Suspended->value, MembershipStatus::LeftOrRemoved->value],
                    'suspension' => [$suspension?->value, null],
                ]);
                $this->entityManager->flush();

                return 1;
            });
        }

        return $removed;
    }

    private function suspend(Membership $membership, Suspension $why, ?User $by): void
    {
        $this->membershipMachine->move($membership, MembershipStatus::Suspended, MembershipChannel::Domain, $by, why: $why);
        $this->auditor->record(MemberSuspension::SUSPENDED, self::SUBJECT, $membership->getId(), null === $by ? Actor::System : Actor::User, $by?->getId(), $by?->getName(), [
            'status' => [MembershipStatus::Active->value, MembershipStatus::Suspended->value],
            'suspension' => [null, $why->value],
        ]);
        $administrators = Vec\map(
            $this->membershipRepository->findAdministratorsIn($membership->getOrganisation()),
            static fn (Membership $administrator): User => $administrator->getUser(),
        );
        $this->afterResponse->defer(function () use ($membership, $administrators): void {
            if ($this->membershipRepository->isSuspendedInStore($membership->getId())) {
                $this->domainSuspensionMailer->sendSuspended($membership, $administrators);
            }
        });
    }
}
