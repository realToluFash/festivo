<?php

declare(strict_types=1);

namespace App\Domain\Organisation\RequestLink;

use App\Audit\Auditor;
use App\Domain\Organisation\DomainJoining\JoinOfferFinder;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Entity\Membership;
use App\Entity\MembershipTransition;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use App\Repository\MembershipTransitionRepository;
use App\Repository\OrganisationRepository;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\RateLimiter\RateLimit;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Asking to join through an organisation's request link (sc-562). There is no other way to find an organisation by it. */
final readonly class LinkRequester
{
    public const string ASKED = 'request_link.asked';

    public const int MESSAGE_MOST = 500;

    public function __construct(
        private OrganisationRepository $organisationRepository,
        private MembershipRepository $membershipRepository,
        private MembershipTransitionRepository $membershipTransitionRepository,
        private MembershipMachine $membershipMachine,
        private RateLimiterFactoryInterface $joinRequestAccountLimiter,
        private RateLimiterFactoryInterface $joinRequestOrganisationLimiter,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** Unknown, switched off and replaced are one refusal, so a token says nothing about whether an organisation exists. */
    public function organisationFor(#[SensitiveParameter] string $token): Organisation
    {
        $organisation = '' === $token ? null : $this->organisationRepository->findOneBy(['requestLinkToken' => Str\lowercase($token)]);

        return $organisation ?? throw new ApiException(ErrorCode::RequestLinkDead, $this->translator->trans('request_link.dead'));
    }

    public function standingOf(User $user, Organisation $organisation): ?RequestStanding
    {
        $status = $this->membershipRepository->findOneBy(['organisation' => $organisation, 'user' => $user])?->getStatus();

        return match (true) {
            true === $status?->holdsRole() => RequestStanding::Member,
            MembershipStatus::PendingApproval === $status => RequestStanding::Waiting,
            default => null === $this->coolingOffUntil($user, $organisation) ? null : RequestStanding::CoolingOff,
        };
    }

    /** The end of the 30 days after the latest request here that was turned down or expired (sc-392); null when there is none. */
    public function coolingOffUntil(User $user, Organisation $organisation): ?DateTimeImmutable
    {
        $ended = Vec\filter(
            $this->membershipTransitionRepository->findRequestsEndedForSince($user, $this->clock->now()->sub(new DateInterval(JoinOfferFinder::COOLING_OFF))),
            static fn (MembershipTransition $step): bool => $step->getMembership()->getOrganisation()->getId()->equals($organisation->getId()),
        );
        $latest = Iter\reduce($ended, static fn (?DateTimeImmutable $at, MembershipTransition $step): DateTimeImmutable => null === $at || $step->getOccurredAt() > $at ? $step->getOccurredAt() : $at, null);

        return $latest?->add(new DateInterval(JoinOfferFinder::COOLING_OFF));
    }

    /** Under the account's lock and the organisation's, so requests sent together are counted one after another on both limits, and charged only once made. */
    public function ask(User $user, Organisation $organisation, ?string $message): Membership
    {
        $asked = $this->entityManager->wrapInTransaction(function () use ($user, $organisation, $message): Membership|ApiException {
            $this->entityManager->refresh($user, LockMode::PESSIMISTIC_WRITE);
            $this->entityManager->refresh($organisation, LockMode::PESSIMISTIC_WRITE);

            $refusal = $this->refusalFor($user, $organisation);

            if (null !== $refusal) {
                return $refusal;
            }

            $byAccount = $this->joinRequestAccountLimiter->create($user->getId()->toRfc4122());
            $byOrganisation = $this->joinRequestOrganisationLimiter->create($organisation->getId()->toRfc4122());
            $spent = Vec\filter([$byAccount->consume(0), $byOrganisation->consume(0)], static fn (RateLimit $peek): bool => $peek->getRemainingTokens() <= 0);

            if ([] !== $spent) {
                // Whose limit it is goes unsaid (#605): the person learns only when they may try again.
                $until = Iter\reduce($spent, static fn (?DateTimeImmutable $at, RateLimit $peek): DateTimeImmutable => null === $at || $peek->getRetryAfter() > $at ? $peek->getRetryAfter() : $at, null);

                return ApiException::tooManyAttempts('Too many requests for now.', $until ?? $this->clock->now());
            }

            $membership = $this->membershipMachine->ask($organisation, $user, MembershipChannel::Request);
            $written = Str\trim($message ?? '');
            $membership->setRequestMessage('' === $written ? null : $written);
            $this->auditor->record(self::ASKED, 'Membership', $membership->getId(), Actor::User, $user->getId(), $user->getName(), [
                'organisation' => [null, $organisation->getId()->toRfc4122()],
                'status' => [null, MembershipStatus::PendingApproval->value],
            ]);
            $this->entityManager->flush();
            $byAccount->consume();
            $byOrganisation->consume();

            return $membership;
        });

        return $asked instanceof ApiException ? throw $asked : $asked;
    }

    private function refusalFor(User $user, Organisation $organisation): ?ApiException
    {
        return match ($this->standingOf($user, $organisation)) {
            RequestStanding::Member => new ApiException(ErrorCode::AlreadyAMember, $this->translator->trans('request_link.member', ['{organisation}' => $organisation->getName()])),
            RequestStanding::Waiting => new ApiException(ErrorCode::JoinRequestWaiting, $this->translator->trans('request_link.waiting', ['{organisation}' => $organisation->getName()])),
            RequestStanding::CoolingOff => new ApiException(
                ErrorCode::JoinRequestCoolingOff,
                $this->translator->trans('request_link.cooling_off', ['{organisation}' => $organisation->getName()]),
                [],
                null,
                [],
                ['until' => $this->coolingOffUntil($user, $organisation)?->format(\DATE_ATOM) ?? ''],
            ),
            null => null,
        };
    }
}
