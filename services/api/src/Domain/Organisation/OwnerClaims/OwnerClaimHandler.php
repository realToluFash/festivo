<?php

declare(strict_types=1);

namespace App\Domain\Organisation\OwnerClaims;

use App\Audit\Auditor;
use App\Domain\Organisation\DomainJoining\JoinOfferFinder;
use App\Domain\Organisation\Interfaces\TxtRecordLookupInterface;
use App\Domain\Organisation\Members\MemberActions;
use App\Domain\Organisation\Roles\RoleAssignment;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\OwnerClaim;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\MembershipStatus;
use App\Enum\OwnerClaimMoment;
use App\Enum\OwnerClaimOutcome;
use App\Enum\SeededRole;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use App\Repository\OrganisationDomainRepository;
use App\Repository\OwnerClaimRepository;
use DateInterval;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\SecureRandom;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Contracts\Translation\TranslatorInterface;

/** An organisation whose only Owner is suspended gets one back (sc-6640): fresh DNS proof, then 72 hours anyone may stop. */
final readonly class OwnerClaimHandler
{
    public const string SUBJECT = 'OwnerClaim';
    public const string STARTED = 'owner_claim.started';
    public const string FOUND = 'owner_claim.found';
    public const string STOPPED = 'owner_claim.stopped';
    public const string WITHDRAWN = 'owner_claim.withdrawn';
    public const string LAPSED = 'owner_claim.lapsed';
    public const string PASSED = 'owner_claim.passed';
    public const string ENDED = 'owner_claim.ended';

    public const string TOLD_AS_ADMINISTRATOR = 'administrator';
    public const string TOLD_AS_OWNER = 'owner';

    private const string RECORD_PREFIX = '_soirely-verify.';
    private const string VALUE_PREFIX = 'soirely-claim=';
    private const string VALUE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

    public function __construct(
        private OwnerClaimRepository $ownerClaimRepository,
        private MembershipRepository $membershipRepository,
        private OrganisationDomainRepository $organisationDomainRepository,
        private RoleAssignment $roleAssignment,
        private TxtRecordLookupInterface $txtRecordLookup,
        private OwnerClaimMailer $ownerClaimMailer,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
        private AfterResponse $afterResponse,
        private RequestStack $requestStack,
    ) {
    }

    public static function recordName(string $domain): string
    {
        return self::RECORD_PREFIX . $domain;
    }

    public function hasNoActiveOwner(Organisation $organisation): bool
    {
        $owners = $this->membershipRepository->findOwnersIn($organisation);

        return !Iter\any($owners, static fn (Membership $owner): bool => $owner->isActive())
            && Iter\any($owners, static fn (Membership $owner): bool => MembershipStatus::Suspended === $owner->getStatus());
    }

    /** The Administrator role itself, active: no other role is offered the claim. */
    public function administratorMembership(User $user, Organisation $organisation): ?Membership
    {
        $membership = $this->membershipRepository->findActive($user, $organisation->getId());

        return SeededRole::Administrator === $membership?->getRole()->getSeededAs() ? $membership : null;
    }

    public function isSuspendedOwner(User $user, Organisation $organisation): bool
    {
        return Iter\any(
            $this->membershipRepository->findOwnersIn($organisation),
            static fn (Membership $owner): bool => MembershipStatus::Suspended === $owner->getStatus() && $owner->getUser()->getId()->equals($user->getId()),
        );
    }

    /** The claimant's own domain when the organisation lists it; otherwise the organisation's, proved first, which a refusal names. */
    public function domainFor(Organisation $organisation, User $user): ?string
    {
        $listings = $this->organisationDomainRepository->findForOrganisation($organisation);
        $own = JoinOfferFinder::domainFor($user);

        if (Iter\any($listings, static fn (OrganisationDomain $listing): bool => $listing->getDomain() === $own)) {
            return $own;
        }

        $proved = Vec\filter($listings, static fn (OrganisationDomain $listing): bool => null !== $listing->getProvedAt());

        return (Iter\first($proved) ?? Iter\first($listings))?->getDomain();
    }

    public function start(Organisation $organisation, User $by): OwnerClaim
    {
        $this->settleDue($organisation);

        return $this->entityManager->wrapInTransaction(function () use ($organisation, $by): OwnerClaim {
            $this->entityManager->refresh($organisation, LockMode::PESSIMISTIC_WRITE);
            $this->mayClaim($organisation, $by);
            $domain = $this->claimableDomain($organisation, $by);
            $now = $this->clock->now();
            $claim = new OwnerClaim($organisation, $by, $domain, self::VALUE_PREFIX . SecureRandom\string(32, self::VALUE_ALPHABET), $now);
            $claim->setCheckedAt($now);
            $this->entityManager->persist($claim);
            $this->record(self::STARTED, $claim, $by, ['domain' => [null, $domain], 'record' => [null, $claim->getRecordValue()]]);
            $this->entityManager->flush();

            return $claim;
        });
    }

    public function check(Organisation $organisation, User $by): OwnerClaim
    {
        $this->settleDue($organisation);
        [$claim, $foundNow] = $this->entityManager->wrapInTransaction(function () use ($organisation, $by): array {
            $claim = $this->lockedOpen($organisation);

            if (null === $claim || !$claim->getClaimant()->getId()->equals($by->getId())) {
                throw new ApiException(ErrorCode::OwnerClaimEnded, $this->translator->trans('owner_claims.ended'));
            }

            $now = $this->clock->now();
            $claim->setCheckedAt($now);
            $foundNow = null === $claim->getFoundAt() && $this->isPublished($claim);

            if ($foundNow) {
                $this->found($claim, $now);
            }

            $this->entityManager->flush();

            return [$claim, $foundNow];
        });

        if ($foundNow) {
            $this->mail(fn () => $this->ownerClaimMailer->sendStarted($claim));
        }

        return $claim;
    }

    public function stop(Organisation $organisation, User $by): OwnerClaim
    {
        $this->settleDue($organisation);

        if (null === $this->administratorMembership($by, $organisation) && !$this->isSuspendedOwner($by, $organisation)) {
            throw $this->isMember($by, $organisation)
                ? new ApiException(ErrorCode::Forbidden, $this->translator->trans('owner_claims.who_may_stop'))
                : ApiException::notFound('Not found.');
        }

        if (true === $this->ownerClaimRepository->findOpenIn($organisation)?->getClaimant()->getId()->equals($by->getId())) {
            throw new ApiException(ErrorCode::OwnerClaimOwn, $this->translator->trans('owner_claims.own'));
        }

        $claim = $this->entityManager->wrapInTransaction(function () use ($organisation, $by): OwnerClaim {
            $claim = $this->lockedOpen($organisation)
                ?? throw new ApiException(ErrorCode::OwnerClaimEnded, $this->translator->trans('owner_claims.nothing_to_stop'));
            $claim->setOutcome(OwnerClaimOutcome::Stopped, $this->clock->now());
            $claim->setStoppedBy($by);
            $this->record(self::STOPPED, $claim, $by, ['outcome' => [null, OwnerClaimOutcome::Stopped->value]]);
            $this->entityManager->flush();

            return $claim;
        });

        $this->mail(fn () => $this->ownerClaimMailer->sendStopped($claim, $by));

        return $claim;
    }

    /** The claimant changing their mind (sc-8204): nobody objected, so unlike a stop it leaves the way open. */
    public function withdraw(Organisation $organisation, User $by): OwnerClaim
    {
        $receivedAt = $this->clock->now();
        $this->settleDue($organisation);

        $claim = $this->entityManager->wrapInTransaction(function () use ($organisation, $by, $receivedAt): OwnerClaim|ApiException {
            $claim = $this->lockedOpen($organisation);

            if (null === $claim) {
                return new ApiException(ErrorCode::OwnerClaimEnded, $this->translator->trans('owner_claims.ended'));
            }

            if (!$claim->getClaimant()->getId()->equals($by->getId())) {
                return new ApiException(ErrorCode::Forbidden, $this->translator->trans('owner_claims.not_claimant'));
            }

            $claim->setOutcome(OwnerClaimOutcome::Withdrawn, $receivedAt);
            $this->record(self::WITHDRAWN, $claim, $by, ['outcome' => [null, OwnerClaimOutcome::Withdrawn->value]]);
            $this->entityManager->flush();

            return $claim;
        });

        if ($claim instanceof ApiException) {
            throw $claim;
        }

        if (null !== $claim->getFoundAt()) {
            $this->mail(fn () => $this->ownerClaimMailer->sendWithdrawn($claim));
        }

        return $claim;
    }

    /** Flushing is the caller's. */
    public function ownerBack(Organisation $organisation, User $by): void
    {
        $claim = $this->ownerClaimRepository->findOpenIn($organisation);

        if (null !== $claim) {
            $this->end($claim, OwnerClaimOutcome::OwnerBack, $this->clock->now(), $by);
        }
    }

    /** @return int how many claims moved: each as of its own instant, as JoinRequests::expireDue ends a request */
    public function settleDue(?Organisation $organisation = null): int
    {
        $moved = 0;

        foreach ($this->ownerClaimRepository->findDue($this->clock->now(), $organisation) as $claim) {
            $moment = $this->entityManager->wrapInTransaction(function () use ($claim): ?OwnerClaimMoment {
                $this->entityManager->refresh($claim, LockMode::PESSIMISTIC_WRITE);
                $moment = $claim->isOpen() ? $this->settle($claim) : null;
                $this->entityManager->flush();

                return $moment;
            });

            match ($moment) {
                OwnerClaimMoment::Found => $this->mail(fn () => $this->ownerClaimMailer->sendStarted($claim)),
                OwnerClaimMoment::Passed => $this->mail(fn () => $this->ownerClaimMailer->sendGranted($claim)),
                OwnerClaimMoment::Ended, null => null,
            };
            $moved += null === $moment ? 0 : 1;
        }

        return $moved;
    }

    private function settle(OwnerClaim $claim): ?OwnerClaimMoment
    {
        $now = $this->clock->now();
        $organisation = $claim->getOrganisation();

        if (!$this->hasNoActiveOwner($organisation)) {
            return $this->end($claim, OwnerClaimOutcome::OwnerBack, $now);
        }

        $passesAt = $claim->getPassesAt();

        if (null !== $passesAt) {
            if ($passesAt > $now) {
                return null;
            }

            if (!$this->isPublished($claim)) {
                return $this->end($claim, OwnerClaimOutcome::RecordRemoved, $passesAt);
            }

            $membership = $this->administratorMembership($claim->getClaimant(), $organisation);

            return null === $membership
                ? $this->end($claim, OwnerClaimOutcome::ClaimantGone, $passesAt)
                : $this->pass($claim, $membership, $passesAt);
        }

        if ($claim->getLapsesAt() <= $now) {
            return $this->end($claim, OwnerClaimOutcome::Unfound, $claim->getLapsesAt());
        }

        $checkedAt = $claim->getCheckedAt();

        if (null !== $checkedAt && $checkedAt->add(new DateInterval(OwnerClaim::CHECKED_EVERY)) > $now) {
            return null;
        }

        $claim->setCheckedAt($now);

        if (!$this->isPublished($claim)) {
            return null;
        }

        $this->found($claim, $now);

        return OwnerClaimMoment::Found;
    }

    /** Active or suspended: anybody else is answered as if the organisation did not exist. */
    private function isMember(User $user, Organisation $organisation): bool
    {
        return null !== $this->membershipRepository->findActive($user, $organisation->getId())
            || Iter\any(
                $this->membershipRepository->findPausedFor($user),
                static fn (Membership $membership): bool => $membership->getOrganisation()->getId()->equals($organisation->getId()),
            );
    }

    private function mayClaim(Organisation $organisation, User $by): void
    {
        if (null === $this->administratorMembership($by, $organisation)) {
            throw new ApiException(ErrorCode::Forbidden, $this->translator->trans('owner_claims.administrators_only'));
        }

        if (!$this->hasNoActiveOwner($organisation)) {
            throw new ApiException(ErrorCode::OwnerClaimUnavailable, $this->translator->trans('owner_claims.has_owner', ['{organisation}' => $organisation->getName()]));
        }

        if (null !== $this->ownerClaimRepository->findStopIn($organisation)) {
            throw new ApiException(ErrorCode::OwnerClaimClosed, $this->translator->trans('owner_claims.closed'));
        }

        $open = $this->ownerClaimRepository->findOpenIn($organisation);

        if (null !== $open) {
            throw new ApiException(ErrorCode::OwnerClaimOpen, $this->translator->trans('owner_claims.open', ['{claimant}' => OwnerClaimDescriber::named($open->getClaimant())]));
        }
    }

    private function claimableDomain(Organisation $organisation, User $by): string
    {
        $domain = $this->domainFor($organisation, $by);

        if (null === $domain) {
            throw new ApiException(ErrorCode::OwnerClaimAddress);
        }

        if (JoinOfferFinder::domainFor($by) !== $domain) {
            throw new ApiException(ErrorCode::OwnerClaimAddress, $this->translator->trans('owner_claims.address', ['{domain}' => $domain]));
        }

        $managedElsewhere = Iter\any(
            $this->organisationDomainRepository->findListings($domain),
            static fn (OrganisationDomain $listing): bool => null !== $listing->getProvedAt() && !$listing->getOrganisation()->getId()->equals($organisation->getId()),
        );

        if ($managedElsewhere) {
            throw new ApiException(ErrorCode::OwnerClaimManaged, $this->translator->trans('owner_claims.managed', ['{domain}' => $domain]));
        }

        return $domain;
    }

    private function lockedOpen(Organisation $organisation): ?OwnerClaim
    {
        $claim = $this->ownerClaimRepository->findOpenIn($organisation);

        if (null === $claim) {
            return null;
        }

        $this->entityManager->refresh($claim, LockMode::PESSIMISTIC_WRITE);

        return $claim->isOpen() ? $claim : null;
    }

    private function isPublished(OwnerClaim $claim): bool
    {
        return Iter\contains($this->txtRecordLookup->lookUp(self::recordName($claim->getDomain())), $claim->getRecordValue());
    }

    /** Who is emailed now is fixed: they are the ones who hear how it ends. */
    private function found(OwnerClaim $claim, DateTimeImmutable $at): void
    {
        $claim->setFoundAt($at);
        $organisation = $claim->getOrganisation();
        $administrators = Vec\filter(
            $this->membershipRepository->findAdministratorsIn($organisation),
            static fn (Membership $membership): bool => SeededRole::Administrator === $membership->getRole()->getSeededAs(),
        );
        $owners = Vec\filter(
            $this->membershipRepository->findOwnersIn($organisation),
            static fn (Membership $membership): bool => MembershipStatus::Suspended === $membership->getStatus(),
        );
        $claim->setTold([
            ...Vec\map($administrators, static fn (Membership $membership): array => ['id' => $membership->getUser()->getId()->toRfc4122(), 'as' => self::TOLD_AS_ADMINISTRATOR]),
            ...Vec\map($owners, static fn (Membership $membership): array => ['id' => $membership->getUser()->getId()->toRfc4122(), 'as' => self::TOLD_AS_OWNER]),
        ]);
        $this->record(self::FOUND, $claim, null, ['foundAt' => [null, $at->format(DateTimeInterface::ATOM)], 'passesAt' => [null, $claim->getPassesAt()?->format(DateTimeInterface::ATOM)]]);
    }

    private function pass(OwnerClaim $claim, Membership $membership, DateTimeImmutable $at): OwnerClaimMoment
    {
        $owner = Type\instance_of(Role::class)->coerce(
            $this->entityManager->getRepository(Role::class)->findOneBy(['organisation' => $claim->getOrganisation(), 'seededAs' => SeededRole::Owner]),
        );
        $before = $membership->getRole();
        $this->roleAssignment->assign($membership, $owner, $at);
        $claim->setOutcome(OwnerClaimOutcome::Passed, $at);
        $this->auditor->record(MemberActions::ROLE_CHANGED, 'Membership', $membership->getId(), changes: [
            'roleId' => [$before->getId()->toRfc4122(), $owner->getId()->toRfc4122()],
        ]);
        $this->record(self::PASSED, $claim, null, [
            'claimant' => [null, $claim->getClaimant()->getId()->toRfc4122()],
            'domain' => [null, $claim->getDomain()],
            'record' => [null, $claim->getRecordValue()],
        ]);

        return OwnerClaimMoment::Passed;
    }

    private function end(OwnerClaim $claim, OwnerClaimOutcome $outcome, DateTimeImmutable $at, ?User $by = null): OwnerClaimMoment
    {
        $claim->setOutcome($outcome, $at);
        $this->record($outcome->lapsed() ? self::LAPSED : self::ENDED, $claim, $by, ['outcome' => [null, $outcome->value]]);

        return OwnerClaimMoment::Ended;
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function record(string $action, OwnerClaim $claim, ?User $by, array $changes): void
    {
        $this->auditor->record($action, self::SUBJECT, $claim->getId(), null === $by ? Actor::System : Actor::User, $by?->getId(), $by?->getName(), $changes);
    }

    /** After the response in a request; at once from the console, where no response ever ends. */
    private function mail(callable $send): void
    {
        if (null === $this->requestStack->getCurrentRequest()) {
            $send();

            return;
        }

        $this->afterResponse->defer($send);
    }
}
