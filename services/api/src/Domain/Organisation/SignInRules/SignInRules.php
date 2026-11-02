<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SignInRules;

use App\Domain\Organisation\SignInRules\Model\InactivityLimit;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\ProviderIdentity;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Grants;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use App\Repository\ProviderIdentityRepository;
use App\Repository\TwoFactorFactorRepository;
use DateInterval;
use DateTimeImmutable;
use DateTimeInterface;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** How an organisation's sign-in rules (sc-69) apply to one member. An organisation with none set changes nothing. */
final readonly class SignInRules
{
    /** The lengths the owner chooses between; null is no limit. */
    public const array INACTIVITY_DAYS = [7, 30];

    /** A member's time to turn two-factor on once it is required: 7 × 24 hours, whatever the clocks do meanwhile. */
    public const string TWO_FACTOR_GRACE = 'PT168H';

    public function __construct(
        private MembershipRepository $membershipRepository,
        private ProviderIdentityRepository $providerIdentityRepository,
        private TwoFactorFactorRepository $twoFactorFactorRepository,
        private UserMailer $userMailer,
        private ClockInterface $clock,
    ) {
    }

    /** The organisation that turns this account's password away: Google or Apple only, and the account has one linked. */
    public function refusingPassword(User $user): ?Organisation
    {
        if (!$this->isLinked($user)) {
            return null;
        }

        return $this->requiringProvider($user);
    }

    /** `oauth_only`, naming the organisation, the address and the providers to use instead: one refusal for sign-in, reset and refresh alike. */
    public function passwordRefusal(User $user): ?ApiException
    {
        $organisation = $this->refusingPassword($user);

        if (null === $organisation) {
            return null;
        }

        return new ApiException(
            ErrorCode::OAuthOnly,
            'sign_in.provider_only',
            [],
            null,
            [],
            [
                'organisation' => $organisation->getName(),
                'email' => $user->getPrimaryEmailAddress()?->getAddress() ?? '',
                'providers' => Vec\map(
                    $this->providerIdentityRepository->findBy(['user' => $user], ['provider' => 'ASC']),
                    static fn (ProviderIdentity $identity): string => $identity->getProvider()->value,
                ),
            ],
        );
    }

    /** Whether the organisation's rules leave this member their administrative duties, such as answering a recovery request. */
    public function leavesAdministration(User $user, Organisation $organisation): bool
    {
        $membership = $this->membershipRepository->findActive($user, $organisation->getId());

        return !($organisation->isProviderSignInOnly() && !$this->isLinked($user))
            && !($organisation->isAdministratorsNeedTwoFactor() && !$this->hasTwoFactor($user))
            && !(null !== $membership && $this->isHeldForTwoFactor($membership));
    }

    public function requiringTwoFactor(User $user): ?Organisation
    {
        return Iter\first(Vec\filter(
            $this->organisationsOf($user),
            static fn (Organisation $organisation): bool => null !== $organisation->getTwoFactorRequiredSince(),
        ));
    }

    /** Seven days from the switch-on, or from joining after it (sc-609). */
    public function twoFactorDeadline(Membership $membership): ?DateTimeImmutable
    {
        $since = $membership->getOrganisation()->getTwoFactorRequiredSince();
        $joined = $membership->getJoinedAt();

        if (null === $since || null === $joined) {
            return null;
        }

        return ($joined > $since ? $joined : $since)->add(new DateInterval(self::TWO_FACTOR_GRACE));
    }

    /** A member whose grace began before this is past the deadline. */
    public function twoFactorGraceStartedBefore(): DateTimeImmutable
    {
        return $this->clock->now()->sub(new DateInterval(self::TWO_FACTOR_GRACE));
    }

    public function isHeldForTwoFactor(Membership $membership): bool
    {
        $deadline = $this->twoFactorDeadline($membership);

        return null !== $deadline && $deadline <= $this->clock->now() && !$this->hasTwoFactor($membership->getUser());
    }

    /** @return ?array{at: string, written: string, overdue: bool} null once two-factor is on, or while nothing requires it */
    public function twoFactorDue(Membership $membership): ?array
    {
        $deadline = $this->twoFactorDeadline($membership);
        $user = $membership->getUser();

        if (null === $deadline || $this->hasTwoFactor($user)) {
            return null;
        }

        return [
            'at' => $deadline->format(DateTimeInterface::ATOM),
            'written' => $this->userMailer->deadline($deadline, $user, $this->userMailer->shownLocaleFor($user)),
            'overdue' => $deadline <= $this->clock->now(),
        ];
    }

    /** The first organisation the account belongs to that signs in with Google or Apple only. */
    public function requiringProvider(User $user): ?Organisation
    {
        return Iter\first(Vec\filter(
            $this->organisationsOf($user),
            static fn (Organisation $organisation): bool => $organisation->isProviderSignInOnly(),
        ));
    }

    /** Read-only until a provider is linked; administration withheld, or everything past its deadline, until two-factor is on. */
    public function narrow(Grants $grants, Membership $membership): Grants
    {
        $user = $membership->getUser();
        $organisation = $membership->getOrganisation();

        if ($organisation->isProviderSignInOnly() && !$this->isLinked($user)) {
            $grants = $grants->readingOnly();
        }

        if ($organisation->isAdministratorsNeedTwoFactor() && !$this->hasTwoFactor($user)) {
            $grants = $grants->withholdingAdministration();
        }

        if ($this->isHeldForTwoFactor($membership)) {
            $grants = $grants->heldForTwoFactor();
        }

        return $grants;
    }

    /** The shortest limit across every organisation the account belongs to; the earliest joined wins a tie. */
    public function inactivityLimit(User $user): ?InactivityLimit
    {
        $limit = null;

        foreach ($this->organisationsOf($user) as $organisation) {
            $days = $organisation->getInactivityTimeoutDays();

            if (null !== $days && (null === $limit || $days < $limit->days)) {
                $limit = new InactivityLimit($organisation, $days);
            }
        }

        return $limit;
    }

    public function isLinked(User $user): bool
    {
        return $this->providerIdentityRepository->count(['user' => $user]) > 0;
    }

    public function hasTwoFactor(User $user): bool
    {
        return null !== $this->twoFactorFactorRepository->findActiveFor($user);
    }

    /** @return list<Organisation> */
    private function organisationsOf(User $user): array
    {
        return Vec\map($this->membershipRepository->findActiveFor($user), static fn (Membership $membership): Organisation => $membership->getOrganisation());
    }
}
