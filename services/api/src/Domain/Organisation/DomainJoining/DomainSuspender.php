<?php

declare(strict_types=1);

namespace App\Domain\Organisation\DomainJoining;

use App\Audit\Auditor;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\Roles\RoleAssignment;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\DomainSuspension;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A domain member keeps access only while the domain still brings them in (sc-564). Flushing is the caller's, but for removeExpired. */
final readonly class DomainSuspender
{
    public const string SUBJECT = 'Membership';
    public const string SUSPENDED = 'membership.suspended';
    public const string RESTORED = 'membership.restored';
    public const string EXPIRED = 'membership.suspension_expired';

    public function __construct(
        private MembershipRepository $membershipRepository,
        private MembershipMachine $membershipMachine,
        private DomainSuspensionMailer $domainSuspensionMailer,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private UserMailer $userMailer,
        private AfterResponse $afterResponse,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private RoleAssignment $roleAssignment,
    ) {
    }

    /**
     * Why, since when, and the one removal instant, each written in the reader's own zone as the screens show it.
     *
     * @return array{reason: string, domain: ?string, since: array{at: string, written: string}, removesAt: array{at: string, written: string}|null, onlyOwner: bool}|null
     */
    public function describe(Membership $membership, User $reader): ?array
    {
        $suspension = $membership->getSuspension();
        $since = $membership->getSuspendedAt();
        $removesAt = $membership->getRemovesAt();

        if (null === $suspension || null === $since) {
            return null;
        }

        $locale = $this->userMailer->localeFor($reader);
        $written = fn (DateTimeImmutable $at): array => [
            'at' => $at->format(DateTimeInterface::ATOM),
            'written' => $this->userMailer->deadline($at, $reader, $locale),
        ];

        return [
            'reason' => $suspension->value,
            'domain' => $membership->getDomain(),
            'since' => $written($since),
            'removesAt' => null === $removesAt ? null : $written($removesAt),
            'onlyOwner' => $this->roleAssignment->isLastOwner($membership),
        ];
    }

    /** After the primary address changes or goes: unlinking a sign-in provider never comes here, the tie is to the address. */
    public function addressChanged(User $user): void
    {
        $domain = JoinOfferFinder::domainFor($user);

        foreach ($this->membershipRepository->findActiveFor($user) as $membership) {
            if (null !== $membership->getDomain() && $membership->getDomain() !== $domain) {
                $this->suspend($membership, DomainSuspension::AddressGone, $user);
            }
        }
    }

    public function domainClosed(Organisation $organisation, string $domain, User $by): void
    {
        foreach ($this->membershipRepository->findActiveAtDomain($domain, $organisation) as $membership) {
            $this->suspend($membership, DomainSuspension::DomainClosed, $by);
        }
    }

    /** Another organisation proved the domain on Enterprise (sc-560): every other organisation's domain members pause. */
    public function domainProved(OrganisationDomain $proved): void
    {
        foreach ($this->membershipRepository->findActiveAtDomain($proved->getDomain(), $proved->getOrganisation(), elsewhere: true) as $membership) {
            $this->suspend($membership, DomainSuspension::DomainManagedElsewhere, null);
        }
    }

    public function restore(Membership $membership, User $by): void
    {
        $suspension = $membership->getSuspension();
        $domain = $membership->getDomain();

        $removesAt = $membership->getRemovesAt();

        if (MembershipStatus::Suspended !== $membership->getStatus() || null === $suspension || (null !== $removesAt && $removesAt <= $this->clock->now())) {
            throw new ApiException(ErrorCode::Conflict, $this->translator->trans('members.not_suspended'));
        }

        if ($suspension->needsTheAddress() && JoinOfferFinder::domainFor($membership->getUser()) !== $domain) {
            throw new ApiException(ErrorCode::RestoreNeedsAddress, $this->translator->trans('members.restore_needs_address', [
                '{name}' => $membership->getUser()->getName(),
                '{domain}' => $domain ?? '',
            ]));
        }

        $this->membershipMachine->move($membership, MembershipStatus::Active, MembershipChannel::Settings, $by);
        $this->auditor->record(self::RESTORED, self::SUBJECT, $membership->getId(), Actor::User, $by->getId(), $by->getName(), [
            'status' => [MembershipStatus::Suspended->value, MembershipStatus::Active->value],
            'suspension' => [$suspension->value, null],
        ]);
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

    private function suspend(Membership $membership, DomainSuspension $why, ?User $by): void
    {
        $this->membershipMachine->move($membership, MembershipStatus::Suspended, MembershipChannel::Domain, $by);
        $membership->setSuspension($why, $this->clock->now());
        $this->auditor->record(self::SUSPENDED, self::SUBJECT, $membership->getId(), null === $by ? Actor::System : Actor::User, $by?->getId(), $by?->getName(), [
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
