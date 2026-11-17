<?php

declare(strict_types=1);

namespace App\Domain\Organisation\DomainJoining;

use App\Entity\Membership;
use App\Entity\MembershipTransition;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\User;
use App\Enum\MembershipStatus;
use App\Repository\JoinOfferDismissalRepository;
use App\Repository\MembershipRepository;
use App\Repository\MembershipTransitionRepository;
use App\Repository\OrganisationDomainRepository;
use DateInterval;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** Which organisations an account may ask to join through its address's domain (sc-561), one request at a time. */
final readonly class JoinOfferFinder
{
    /** A request turned down or expired keeps that organisation from being offered for this long (sc-392). */
    public const string COOLING_OFF = 'PT720H';

    public function __construct(
        private OrganisationDomainRepository $organisationDomainRepository,
        private MembershipRepository $membershipRepository,
        private MembershipTransitionRepository $membershipTransitionRepository,
        private JoinOfferDismissalRepository $joinOfferDismissalRepository,
        private ClockInterface $clock,
    ) {
    }

    /** Only the verified primary address counts: an alternative or unverified one proves nothing about an employer. */
    public static function domainFor(User $user): ?string
    {
        $primary = $user->getPrimaryEmailAddress();

        return null !== $primary && $primary->isVerified() ? DomainNameNormaliser::domainOf($primary->getAddress()) : null;
    }

    /**
     * A domain an organisation has proved (sc-560) is listed by that organisation alone; otherwise every listing works.
     *
     * @param list<OrganisationDomain> $listings
     *
     * @return list<OrganisationDomain>
     */
    public static function working(array $listings): array
    {
        $proved = Vec\filter($listings, static fn (OrganisationDomain $listing): bool => null !== $listing->getProvedAt());

        return [] === $proved ? $listings : $proved;
    }

    /** @return list<Organisation> none while a request is waiting anywhere, so nobody is approved in two places */
    public function offersFor(User $user): array
    {
        $domain = self::domainFor($user);

        if (null === $domain || null !== $this->pendingRequestFor($user)) {
            return [];
        }

        $memberships = $this->membershipRepository->findAllFor($user);
        $held = Vec\map(
            Vec\filter($memberships, static fn (Membership $membership): bool => MembershipStatus::LeftOrRemoved !== $membership->getStatus()),
            static fn (Membership $membership): string => $membership->getOrganisation()->getId()->toRfc4122(),
        );
        $coolingOff = Vec\map(
            $this->membershipTransitionRepository->findRequestsEndedForSince($user, $this->clock->now()->sub(new DateInterval(self::COOLING_OFF))),
            static fn (MembershipTransition $step): string => $step->getMembership()->getOrganisation()->getId()->toRfc4122(),
        );
        $dismissed = $this->joinOfferDismissalRepository->findOrganisationIdsDismissedBy($user);
        $excluded = [...$held, ...$coolingOff, ...$dismissed];

        return Vec\filter(
            Vec\map(self::working($this->organisationDomainRepository->findListings($domain)), static fn (OrganisationDomain $listing): Organisation => $listing->getOrganisation()),
            static fn (Organisation $organisation): bool => !Iter\contains($excluded, $organisation->getId()->toRfc4122()),
        );
    }

    public function isOffered(User $user, Organisation $organisation): bool
    {
        return Iter\any($this->offersFor($user), static fn (Organisation $offered): bool => $offered->getId()->equals($organisation->getId()));
    }

    public function pendingRequestFor(User $user): ?Membership
    {
        return Iter\first(Vec\filter(
            $this->membershipRepository->findAllFor($user),
            static fn (Membership $membership): bool => MembershipStatus::PendingApproval === $membership->getStatus(),
        ));
    }
}
